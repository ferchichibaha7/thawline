"""Indeed Hiring Lab Job Postings Index (spec 6.1, source `indeed_jpi`).

Taken from the public GitHub repository, where CC BY 4.0 applies. FRED's copies
of these series are copyrighted with pre-approval required, so they are not used.
"""

from __future__ import annotations

import io
import json
import re
from datetime import date

import pandas as pd
from pydantic import BaseModel, ConfigDict, field_validator

from .. import checks, db
from ..config import COUNTRY_LABELS, UI_COUNTRIES
from ..http import fetch

DATASET = {
    "id": "indeed_jpi",
    "name": "Indeed Job Postings Index",
    "source_url": "https://github.com/hiring-lab/job_postings_tracker",
    "license": "CC BY 4.0",
    "attribution": "Indeed Hiring Lab",
    "cadence_hours": 168,
    "notes": "Daily seasonally adjusted index of job postings on Indeed, 1 Feb 2020 = 100, "
             "seven-day trailing average. Refreshed weekly.",
}

REPO = "hiring-lab/job_postings_tracker"
BRANCH = "master"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}"
TREE = f"https://api.github.com/repos/{REPO}/git/trees/{BRANCH}?recursive=1"

AGGREGATE_COLUMNS = {"date", "jobcountry", "indeed_job_postings_index_SA",
                     "indeed_job_postings_index_NSA", "variable"}
SECTOR_COLUMNS = {"date", "jobcountry", "indeed_job_postings_index", "variable", "display_name"}
VARIABLES = {"total postings", "new postings"}


class AggregateRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    jobcountry: str
    indeed_job_postings_index_SA: float
    indeed_job_postings_index_NSA: float
    variable: str

    @field_validator("variable")
    @classmethod
    def known_variable(cls, v: str) -> str:
        if v not in VARIABLES:
            raise ValueError(f"unknown variable {v!r}")
        return v


class SectorRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    jobcountry: str
    indeed_job_postings_index: float
    variable: str
    display_name: str

    @field_validator("variable")
    @classmethod
    def known_variable(cls, v: str) -> str:
        if v not in VARIABLES:
            raise ValueError(f"unknown variable {v!r}")
        return v


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", "and")).strip("-")


def series_id(country: str, sector: str | None) -> str:
    return f"indeed.{country}.{slug(sector) if sector else 'all'}"


def parse(content: bytes, kind: str, folder: str) -> pd.DataFrame:
    """Parse one Indeed CSV into (date, sector, value) rows of total postings."""
    df = pd.read_csv(io.BytesIO(content), dtype={"jobcountry": str})
    expected = AGGREGATE_COLUMNS if kind == "aggregate" else SECTOR_COLUMNS
    if set(df.columns) != expected:
        raise ValueError(f"Indeed {kind} file for {folder}: columns changed to {sorted(df.columns)}")
    model = AggregateRow if kind == "aggregate" else SectorRow
    # Validate the first and last rows strictly; the vectorised checks below cover the rest.
    for record in pd.concat([df.head(50), df.tail(50)]).to_dict("records"):
        model(**record)
    unknown = set(df["variable"].unique()) - VARIABLES
    if unknown:
        raise ValueError(f"Indeed {kind} file for {folder}: unknown variables {unknown}")
    if set(df["jobcountry"].unique()) != {folder}:
        raise ValueError(f"Indeed {kind} file for {folder}: unexpected country codes")
    df = df[df["variable"] == "total postings"].copy()
    df["date"] = pd.to_datetime(df["date"]).dt.date
    if kind == "aggregate":
        out = pd.DataFrame({"date": df["date"], "sector": None,
                            "value": df["indeed_job_postings_index_SA"]})
    else:
        out = pd.DataFrame({"date": df["date"], "sector": df["display_name"],
                            "value": df["indeed_job_postings_index"]})
    out = out.dropna(subset=["value"])
    return out


def list_folders() -> dict[str, set[str]]:
    tree = json.loads(fetch("indeed_jpi", "tree.json", TREE))
    folders: dict[str, set[str]] = {}
    for item in tree["tree"]:
        parts = item["path"].split("/")
        if len(parts) == 2 and re.fullmatch(r"[A-Z]{2}", parts[0]):
            folders.setdefault(parts[0], set()).add(parts[1])
    return folders


def run(conn) -> int:
    db.upsert_dataset(conn, **DATASET)
    folders = list_folders()
    total = 0
    latest: date | None = None
    for folder in sorted(folders):
        files = folders[folder]
        frames = []
        agg_name = f"aggregate_job_postings_{folder}.csv"
        if agg_name in files:
            frames.append(parse(fetch("indeed_jpi", f"{folder}_{agg_name}", f"{RAW}/{folder}/{agg_name}",
                                      reuse_today=True),
                                "aggregate", folder))
        sec_name = f"job_postings_by_sector_{folder}.csv"
        if sec_name in files:
            frames.append(parse(fetch("indeed_jpi", f"{folder}_{sec_name}", f"{RAW}/{folder}/{sec_name}",
                                      reuse_today=True),
                                "sector", folder))
        if not frames:
            continue
        df = pd.concat(frames, ignore_index=True)
        df["series_id"] = [series_id(folder, s) for s in df["sector"]]
        # Spec 11.1 says 5 to 500. Real sector series leave that range: AU Logistic
        # Support peaked at 520 in 2021 and GB Hospitality & Tourism fell to 4.9 in
        # 2020. The guard is 1 to 1000. See docs/DECISIONS.md D-008.
        checks.observations(df, low=1, high=1000, label=f"Indeed {folder}")

        sort = UI_COUNTRIES.index(folder) + 1 if folder in UI_COUNTRIES else None
        conn.execute(
            """insert into countries (code, label, indeed_folder, sort) values (%s, %s, %s, %s)
               on conflict (code) do update set label = excluded.label,
                 indeed_folder = excluded.indeed_folder, sort = excluded.sort""",
            (folder, COUNTRY_LABELS.get(folder, folder), folder, sort),
        )
        series_rows = []
        for sector in df["sector"].drop_duplicates():
            label = sector if sector else "All jobs"
            series_rows.append({
                "id": series_id(folder, sector), "dataset_id": "indeed_jpi",
                "label": f"{label}, {COUNTRY_LABELS.get(folder, folder)}",
                "unit": "index, 1 Feb 2020 = 100", "country": folder, "sector": sector,
                "frequency": "daily", "seasonal_adj": True,
                "note": "Total postings, seasonally adjusted, seven-day trailing average.",
            })
        db.upsert_series(conn, series_rows)
        total += db.replace_observations(
            conn, zip(df["series_id"], df["date"], df["value"].astype(float), strict=True))
        folder_latest = max(df["date"])
        latest = folder_latest if latest is None else max(latest, folder_latest)
    db.mark_attempt(conn, "indeed_jpi", "ok", data_through=latest, row_count=total)
    return total
