"""FRED (spec 6.1, source `fred`).

Uses the FRED API when FRED_API_KEY is set. Without a key it reads FRED's public
CSV download (fredgraph.csv), which serves the same observations.

NASDAQCOM is not ingested: FRED marks it "copyrighted: pre-approval required"
(checked 2026-11-10). See docs/SOURCES_VERIFIED.md and docs/DECISIONS.md D-007.
"""

from __future__ import annotations

import io
import json
from datetime import date

import pandas as pd
from pydantic import BaseModel

from .. import checks, db
from ..config import FRED_API_KEY
from ..http import fetch

DATASET = {
    "id": "fred",
    "name": "FRED economic series",
    "source_url": "https://fred.stlouisfed.org/",
    "license": "Public domain, citation requested",
    "attribution": "Federal Reserve Bank of St. Louis, FRED. Original sources: Board of "
                   "Governors of the Federal Reserve System (DGS10), US Bureau of Labor "
                   "Statistics (UNRATE)",
    "cadence_hours": 168,
    "notes": "10-year Treasury yield (daily) and US unemployment rate (monthly).",
}

SERIES = [
    {"fred_id": "DGS10", "label": "10-year Treasury yield", "unit": "percent",
     "frequency": "daily", "seasonal_adj": False, "low": -5, "high": 25},
    {"fred_id": "UNRATE", "label": "US unemployment rate", "unit": "percent",
     "frequency": "monthly", "seasonal_adj": True, "low": 0, "high": 40},
]
EXCLUDED = {"NASDAQCOM": "FRED marks it copyrighted: pre-approval required."}


class ApiObservation(BaseModel):
    date: date
    value: str


def parse_csv(content: bytes, fred_id: str) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(content), na_values=["."])
    if list(df.columns) != ["observation_date", fred_id]:
        raise ValueError(f"FRED {fred_id}: columns changed to {list(df.columns)}")
    df = df.rename(columns={"observation_date": "date", fred_id: "value"}).dropna()
    df["date"] = pd.to_datetime(df["date"]).dt.date
    return df


def parse_api(content: bytes) -> pd.DataFrame:
    payload = json.loads(content)
    rows = [ApiObservation(**o) for o in payload["observations"]]
    df = pd.DataFrame([{"date": r.date, "value": r.value} for r in rows])
    df = df[df["value"] != "."]
    df["value"] = df["value"].astype(float)
    return df


def run(conn) -> int:
    db.upsert_dataset(conn, **DATASET)
    total = 0
    latest = None
    for spec in SERIES:
        fid = spec["fred_id"]
        if FRED_API_KEY:
            url = ("https://api.stlouisfed.org/fred/series/observations"
                   f"?series_id={fid}&api_key={FRED_API_KEY}&file_type=json")
            df = parse_api(fetch("fred", f"{fid}.json", url))
        else:
            url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fid}"
            df = parse_csv(fetch("fred", f"{fid}.csv", url), fid)
        sid = f"fred.{fid}"
        df["series_id"] = sid
        checks.observations(df, low=spec["low"], high=spec["high"], label=f"FRED {fid}",
                            max_weekly_change=None)
        db.upsert_series(conn, [{
            "id": sid, "dataset_id": "fred", "label": spec["label"], "unit": spec["unit"],
            "country": "US", "frequency": spec["frequency"], "seasonal_adj": spec["seasonal_adj"],
            "note": f"FRED series {fid}.",
        }])
        total += db.replace_observations(conn, zip(df["series_id"], df["date"], df["value"], strict=True))
        latest = max(df["date"]) if latest is None else max(latest, max(df["date"]))
    db.mark_attempt(conn, "fred", "ok", data_through=latest, row_count=total)
    return total
