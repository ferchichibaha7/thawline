"""Forecasts, version fc-1 (spec 8.3).

For each postings index with enough history: backtest six simple models on the
log of the weekly index, pick the one with the lowest mean MASE, and publish a
projection only when it beats the naive model clearly at 26 weeks. Ranges come
from resampling the chosen model's own backtest errors in 8-week blocks.
"""

from __future__ import annotations

import math
import warnings
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd

from .. import db
from ..config import metrics
from ..derive.weekly import load_weekly

MODELS = ["naive", "drift", "ets_damped", "arima011_drift", "arima111", "theta"]


# ------------------------------------------------------------------ models

def predict(model: str, y: np.ndarray, h: int) -> np.ndarray:
    """Point forecast of h steps for the log series y."""
    if model == "naive":
        return np.repeat(y[-1], h)
    if model == "drift":
        slope = (y[-1] - y[0]) / (len(y) - 1)
        return y[-1] + slope * np.arange(1, h + 1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if model == "ets_damped":
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
            fit = ExponentialSmoothing(y, trend="add", damped_trend=True,
                                       initialization_method="estimated").fit()
            return np.asarray(fit.forecast(h))
        if model == "arima011_drift":
            from statsmodels.tsa.arima.model import ARIMA
            fit = ARIMA(y, order=(0, 1, 1), trend="t").fit()
            return np.asarray(fit.forecast(h))
        if model == "arima111":
            from statsmodels.tsa.arima.model import ARIMA
            fit = ARIMA(y, order=(1, 1, 1)).fit()
            return np.asarray(fit.forecast(h))
        if model == "theta":
            from statsmodels.tsa.forecasting.theta import ThetaModel
            fit = ThetaModel(y, period=52, deseasonalize=False).fit()
            return np.asarray(fit.forecast(h))
    raise ValueError(model)


# ------------------------------------------------------------------ backtest

@dataclass
class Backtest:
    errors: dict[str, dict[int, np.ndarray]]  # model -> origin -> errors for k=1..K
    mase: dict[str, dict[int, float]]          # model -> horizon -> MASE


def backtest(y: np.ndarray) -> Backtest:
    cfg = metrics()["forecast"]
    n = len(y)
    max_h = max(cfg["horizons"])
    origins = list(range(n - cfg["backtest_weeks"], n, cfg["origin_step"]))
    errors: dict[str, dict[int, np.ndarray]] = {m: {} for m in MODELS}
    for o in origins:
        k = min(max_h, n - o)
        actual = y[o:o + k]
        for m in MODELS:
            try:
                fc = predict(m, y[:o], k)
            except Exception:  # a model that fails to fit at an origin is skipped there
                continue
            if np.all(np.isfinite(fc)):
                errors[m][o] = actual - fc
    mase: dict[str, dict[int, float]] = {}
    for m in MODELS:
        mase[m] = {}
        for h in cfg["horizons"]:
            common = [o for o, e in errors[m].items() if len(e) >= h and o in errors["naive"]]
            if not common:
                mase[m][h] = math.nan
                continue
            num = np.mean([abs(errors[m][o][h - 1]) for o in common])
            den = np.mean([abs(errors["naive"][o][h - 1]) for o in common])
            mase[m][h] = float(num / den) if den > 0 else math.nan
    return Backtest(errors=errors, mase=mase)


def choose(bt: Backtest) -> str:
    def mean_mase(m: str) -> float:
        vals = [v for v in bt.mase[m].values() if not math.isnan(v)]
        return float(np.mean(vals)) if len(vals) == len(bt.mase[m]) else math.inf
    return min(MODELS, key=mean_mase)


# ------------------------------------------------------------------ simulation

def simulate_errors(errors: dict[int, np.ndarray], weeks: int, n_paths: int, block: int,
                    rng: np.random.Generator) -> np.ndarray:
    """Error paths built from 8-week blocks of the backtest's error increments.

    Increments within a block come from one backtest origin, so their correlation
    is kept. A block uses increments from the same horizons when some origin
    reached that far; beyond the longest backtested horizon it draws a block from
    any horizon, so uncertainty keeps growing instead of stopping at 52 weeks.
    """
    incs = {o: np.diff(np.concatenate([[0.0], e])) for o, e in errors.items()}
    out = np.zeros((n_paths, weeks))
    full = [o for o, d in incs.items() if len(d) >= block]
    for b in range(0, weeks, block):
        size = min(block, weeks - b)
        covering = [o for o, d in incs.items() if len(d) >= b + size]
        for p in range(n_paths):
            if covering:
                o = covering[rng.integers(len(covering))]
                out[p, b:b + size] = incs[o][b:b + size]
            else:
                o = full[rng.integers(len(full))]
                start = rng.integers(0, len(incs[o]) - size + 1)
                out[p, b:b + size] = incs[o][start:start + size]
    return np.cumsum(out, axis=1)


def recovery(paths: np.ndarray, weeks: list[date], latest: float) -> dict:
    """First week each simulated path reaches 100; report q20 and q80 (spec 8.3 step 7)."""
    if latest >= 100:
        return {"status": "above", "q20": None, "q80": None}
    crossed = paths >= 100.0
    first = np.where(crossed.any(axis=1), crossed.argmax(axis=1), np.iinfo(np.int32).max)
    first = np.sort(first)
    n = len(first)

    def quantile_week(q: float) -> str | None:
        idx = first[min(n - 1, math.ceil(q * n) - 1)]
        return None if idx >= len(weeks) else weeks[idx].isoformat()

    q20, q80 = quantile_week(0.2), quantile_week(0.8)
    if q80 is not None:
        status = "range"
    elif q20 is not None:
        status = "earliest"
    else:
        status = "none"
    return {"status": status, "q20": q20, "q80": q80,
            "share_crossing": round(float(crossed.any(axis=1).mean()), 3)}


# ------------------------------------------------------------------ one series

def forecast_series(sid: str, weekly: pd.Series) -> dict | None:
    cfg = metrics()["forecast"]
    if len(weekly) < cfg["min_weeks"]:
        return None
    y = np.log(weekly.to_numpy())
    bt = backtest(y)
    model = choose(bt)
    m13, m26, m52 = (bt.mase[model].get(h) for h in cfg["horizons"])
    shipped = bool(m26 is not None and not math.isnan(m26) and m26 < cfg["ship_mase_26"])
    made_on = weekly.index[-1].date()
    scores = {m: {str(h): (None if math.isnan(v) else round(v, 4)) for h, v in bt.mase[m].items()}
              for m in MODELS}
    result = {"series_id": sid, "made_on": made_on, "model": model,
              "mase_13": m13, "mase_26": m26, "mase_52": m52, "shipped": shipped,
              "paths": {"backtest": scores}, "recovery": None}
    if not shipped:
        return result

    weeks_out = cfg["publish_weeks"]
    point = predict(model, y, weeks_out)
    rng = np.random.default_rng(cfg["seed"])
    err = simulate_errors(bt.errors[model], weeks_out, cfg["paths"], cfg["block_weeks"], rng)
    sims = np.exp(point[None, :] + err)
    future = [(weekly.index[-1] + pd.Timedelta(weeks=i)).date() for i in range(1, weeks_out + 1)]
    pct = {f"p{q}": np.round(np.percentile(sims, q, axis=0), 2).tolist()
           for q in (10, 25, 50, 75, 90)}
    result["paths"] = {"start": made_on.isoformat(), "weeks": [d.isoformat() for d in future],
                       **pct, "backtest": scores}
    result["recovery"] = recovery(sims, future, float(weekly.iloc[-1]))
    return result


def _worker(args):
    sid, values, index = args
    s = pd.Series(values, index=pd.DatetimeIndex(index))
    return forecast_series(sid, s)


def target_series(conn) -> list[str]:
    """Postings indexes shown anywhere on the site: family sectors, line-strip sectors and
    the all-jobs aggregate, for every country Indeed publishes."""
    from ..sources.indeed import series_id
    sectors = {r[0] for r in conn.execute(
        "select distinct indeed_sector from role_families where indeed_sector is not null")}
    sectors |= {s["sector"] for s in metrics()["line_strip"]["sectors"]}
    ids = []
    for (country,) in conn.execute(
            "select code from countries where indeed_folder is not null order by code"):
        ids.append(series_id(country, None))
        ids += [series_id(country, s) for s in sorted(sectors)]
    return ids


def run(conn, workers: int | None = None) -> int:
    cfg = metrics()["forecast"]
    weekly = load_weekly(conn, target_series(conn))
    tasks = [(sid, s.to_numpy(), s.index.to_numpy()) for sid, s in weekly.items()]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        results = [r for r in pool.map(_worker, tasks, chunksize=1) if r]
    for r in results:
        conn.execute(
            """insert into forecasts (series_id, made_on, model, mase_13, mase_26, mase_52, shipped,
                                      paths, recovery, version)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (series_id, made_on, version) do update set model = excluded.model,
                 mase_13 = excluded.mase_13, mase_26 = excluded.mase_26,
                 mase_52 = excluded.mase_52, shipped = excluded.shipped,
                 paths = excluded.paths, recovery = excluded.recovery""",
            (r["series_id"], r["made_on"], r["model"], _f(r["mase_13"]), _f(r["mase_26"]),
             _f(r["mase_52"]), r["shipped"], db.jsonb(r["paths"]),
             db.jsonb(r["recovery"]) if r["recovery"] else None, cfg["version"]),
        )
    return len(results)


def _f(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)
