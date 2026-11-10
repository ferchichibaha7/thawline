"""US Bureau of Labor Statistics API (spec 6.1, source `bls`).

Uses API v2 with BLS_API_KEY when set (20 years per request, 500 requests a day).
Without a key it uses API v1, which needs no registration but allows 10 years per
request and 25 requests a day. A full refresh needs 4 requests.
"""

from __future__ import annotations

import json
from datetime import date

import pandas as pd
import yaml
from pydantic import BaseModel

from .. import checks, db
from ..config import BLS_API_KEY, SOURCES_DIR
from ..http import fetch

DATASET = {
    "id": "bls",
    "name": "BLS employment and job openings",
    "source_url": "https://www.bls.gov/developers/",
    "license": "Public domain",
    "attribution": "US Bureau of Labor Statistics",
    "cadence_hours": 744,
    "notes": "Current Employment Statistics and JOLTS, seasonally adjusted, monthly.",
}


class BlsPoint(BaseModel):
    year: str
    period: str
    value: str


class BlsSeries(BaseModel):
    seriesID: str
    data: list[BlsPoint]


class BlsResponse(BaseModel):
    status: str
    message: list[str] = []
    Results: dict | None = None


def config() -> dict:
    return yaml.safe_load((SOURCES_DIR / "bls_series.yaml").read_text())


def parse(content: bytes) -> pd.DataFrame:
    resp = BlsResponse(**json.loads(content))
    if resp.status != "REQUEST_SUCCEEDED" or resp.Results is None:
        raise RuntimeError(f"BLS request failed: {resp.status} {resp.message}")
    rows = []
    for raw in resp.Results["series"]:
        s = BlsSeries(**raw)
        for p in s.data:
            if not p.period.startswith("M") or p.period == "M13" or p.value in ("-", ""):
                continue
            rows.append({"series_id": f"bls.{s.seriesID}",
                         "date": date(int(p.year), int(p.period[1:]), 1),
                         "value": float(p.value)})
    return pd.DataFrame(rows, columns=["series_id", "date", "value"])


def run(conn) -> int:
    db.upsert_dataset(conn, **DATASET)
    cfg = config()
    ids = [s["id"] for s in cfg["series"]]
    span = 20 if BLS_API_KEY else 10
    version = "v2" if BLS_API_KEY else "v1"
    url = f"https://api.bls.gov/publicAPI/{version}/timeseries/data/"
    frames = []
    this_year = date.today().year
    for start in range(cfg["start_year"], this_year + 1, span):
        end = min(start + span - 1, this_year)
        body = {"seriesid": ids, "startyear": str(start), "endyear": str(end)}
        if BLS_API_KEY:
            body["registrationkey"] = BLS_API_KEY
        content = fetch("bls", f"{start}-{end}.json", url, method="POST", json=body)
        frames.append(parse(content))
    df = pd.concat(frames, ignore_index=True).drop_duplicates(["series_id", "date"])
    checks.observations(df, low=0, label="BLS", max_weekly_change=None)
    db.upsert_series(conn, [{
        "id": f"bls.{s['id']}", "dataset_id": "bls", "label": s["label"], "unit": s["unit"],
        "country": "US", "frequency": "monthly", "seasonal_adj": s["seasonal_adj"],
        "note": f"BLS series {s['id']}.",
    } for s in cfg["series"]])
    n = db.replace_observations(conn, zip(df["series_id"], df["date"], df["value"], strict=True))
    db.mark_attempt(conn, "bls", "ok", data_through=max(df["date"]), row_count=n)
    return n
