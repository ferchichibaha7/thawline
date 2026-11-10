"""Weekly series helpers shared by the index, forecasts and signals."""

from __future__ import annotations

import pandas as pd


def load_weekly(conn, series_ids: list[str] | None = None, dataset: str | None = None
                ) -> dict[str, pd.Series]:
    """Weekly means ending Friday for the given series, as {series_id: Series(index=week)}."""
    if series_ids is not None and not series_ids:
        return {}
    sql = "select o.series_id, o.date, o.value from observations o"
    params: list = []
    if dataset:
        sql += " join series s on s.id = o.series_id where s.dataset_id = %s"
        params.append(dataset)
    if series_ids is not None:
        sql += (" and" if dataset else " where") + " o.series_id = any(%s)"
        params.append(series_ids)
    rows = conn.execute(sql, params).fetchall()
    if not rows:
        return {}
    df = pd.DataFrame(rows, columns=["series_id", "date", "value"])
    df["date"] = pd.to_datetime(df["date"])
    out: dict[str, pd.Series] = {}
    for sid, g in df.groupby("series_id"):
        s = g.set_index("date")["value"].sort_index().resample("W-FRI").mean().dropna()
        out[sid] = s
    return out


def four_week_mean(s: pd.Series) -> pd.Series:
    return s.rolling(4, min_periods=4).mean().dropna()


def pct_change(s: pd.Series, weeks: int) -> pd.Series:
    return (s / s.shift(weeks) - 1.0) * 100.0
