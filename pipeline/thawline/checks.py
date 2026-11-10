"""Data checks that run inside each job and fail it (spec 11.1)."""

from __future__ import annotations

from datetime import date

import pandas as pd


class DataCheckError(Exception):
    pass


def observations(df: pd.DataFrame, *, low: float | None = None, high: float | None = None,
                 label: str, max_weekly_change: float | None = 0.25,
                 recent_weeks: int = 8) -> None:
    """Check (series_id, date, value) rows before they are written.

    - no future dates
    - values inside [low, high] when given
    - no duplicate (series_id, date) keys
    - the weekly mean moves less than `max_weekly_change` week on week over the most
      recent weeks. Older history is not re-checked, so pandemic-era swings that the
      source has published for years do not block new data.
    """
    today = date.today()
    if (df["date"] > today).any():
        raise DataCheckError(f"{label}: future dates present")
    if df.duplicated(["series_id", "date"]).any():
        raise DataCheckError(f"{label}: duplicate (series, date) keys")
    if low is not None and (df["value"] < low).any():
        bad = df[df["value"] < low].iloc[0]
        raise DataCheckError(f"{label}: value {bad['value']} below {low} in {bad['series_id']}")
    if high is not None and (df["value"] > high).any():
        bad = df[df["value"] > high].iloc[0]
        raise DataCheckError(f"{label}: value {bad['value']} above {high} in {bad['series_id']}")
    if max_weekly_change is not None:
        weekly = weekly_means(df)
        for sid, s in weekly.groupby(level=0):
            recent = s.droplevel(0).iloc[-(recent_weeks + 1):]
            change = recent.pct_change().abs().dropna()
            if (change > max_weekly_change).any():
                raise DataCheckError(
                    f"{label}: {sid} moved more than {max_weekly_change:.0%} in one week "
                    f"recently; confirm against the source before accepting")


def weekly_means(df: pd.DataFrame) -> pd.Series:
    """Weekly means ending Friday, indexed by (series_id, week)."""
    tmp = df.copy()
    tmp["date"] = pd.to_datetime(tmp["date"])
    return (tmp.set_index("date").groupby("series_id")["value"]
            .resample("W-FRI").mean().dropna())


def percent_between(values: pd.Series, low: float = 0, high: float = 100, label: str = "") -> None:
    if ((values < low) | (values > high)).any():
        raise DataCheckError(f"{label}: values outside {low} to {high}")
