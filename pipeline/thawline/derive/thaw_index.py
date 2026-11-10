"""Thaw Index, version ti-1 (spec 8.1).

Phase 1 has the Level and Momentum components only. The other three components
need job-board data (phase 3); their weights are dropped and the remaining
weights renormalised to sum to 100, as the spec requires.
"""

from __future__ import annotations

import math

import pandas as pd

from .. import checks, db
from ..config import metrics
from ..sources.indeed import series_id
from .weekly import four_week_mean, load_weekly, pct_change


def clamp(x: float) -> float:
    return min(100.0, max(0.0, x))


def level_score(index_4wk: float) -> float:
    cfg = metrics()["thaw_index"]["level"]
    return clamp((index_4wk - cfg["floor"]) / cfg["span"] * 100.0)


def momentum_score(change_pct: float) -> float:
    cfg = metrics()["thaw_index"]["momentum"]
    return clamp((change_pct - cfg["low"]) / cfg["span"] * 100.0)


def state_for(score: float) -> str:
    name = None
    for band in metrics()["thaw_index"]["states"]:
        if score >= band["min"]:
            name = band["name"]
    return name


def combine(components: dict[str, float | None]) -> tuple[float | None, dict[str, float]]:
    """Weighted mean of available components, weights renormalised to sum to 100."""
    cfg = metrics()["thaw_index"]
    if any(components.get(k) is None for k in cfg["required"]):
        return None, {}
    used = {k: cfg["weights"][k] for k, v in components.items() if v is not None}
    total = sum(used.values())
    weights = {k: round(w / total * 100.0, 4) for k, w in used.items()}
    score = sum(components[k] * used[k] for k in used) / total
    return score, weights


def sector_components(weekly_index: pd.Series) -> pd.DataFrame:
    """Level and Momentum inputs and scores for every week of one sector series."""
    cfg = metrics()["thaw_index"]
    i4 = four_week_mean(weekly_index)
    m = pct_change(i4, cfg["momentum"]["weeks"])
    df = pd.DataFrame({"i4": i4, "m": m}).dropna()
    df["level"] = df["i4"].map(level_score)
    df["momentum"] = df["m"].map(momentum_score)
    return df


def run(conn) -> int:
    cfg = metrics()["thaw_index"]
    families = conn.execute("select id, indeed_sector from role_families").fetchall()
    countries = [r[0] for r in conn.execute(
        "select distinct country from series where dataset_id = 'indeed_jpi' and sector is not null"
    ).fetchall()]
    sectors = sorted({s for _, s in families if s})
    wanted = [series_id(c, s) for c in countries for s in sectors]
    weekly = load_weekly(conn, wanted)

    rows = []
    for country in countries:
        for sector in sectors:
            sid = series_id(country, sector)
            if sid not in weekly:
                continue
            comp = sector_components(weekly[sid])
            for week, r in comp.iterrows():
                score, weights = combine({"level": r["level"], "momentum": r["momentum"],
                                          "breadth": None, "entry_access": None,
                                          "competition": None})
                if score is None or math.isnan(score):
                    continue
                for fam_id, fam_sector in families:
                    if fam_sector != sector:
                        continue
                    rows.append((week.date(), fam_id, country, score, state_for(score),
                                 r["level"], r["momentum"], db.jsonb(weights), cfg["version"]))
    checks.percent_between(pd.Series([r[3] for r in rows]), label="Thaw Index")

    conn.execute(
        "create temp table ti_stage (like thaw_index including defaults) on commit drop")
    with conn.cursor().copy(
        "copy ti_stage (week, family_id, country, score, state, level, momentum, weights, version)"
        " from stdin") as copy:
        for row in rows:
            copy.write_row(row)
    conn.execute("delete from thaw_index where version = %s", (cfg["version"],))
    conn.execute("insert into thaw_index select * from ti_stage")
    return len(rows)
