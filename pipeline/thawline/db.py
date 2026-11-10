"""Database connection and upsert helpers."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime

import psycopg

from .config import DATABASE_URL


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        yield conn


def now() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------- bookkeeping

def start_run(conn: psycopg.Connection, job: str) -> int:
    row = conn.execute(
        "insert into pipeline_runs (job, started_at, status) values (%s, %s, 'running') returning id",
        (job, now()),
    ).fetchone()
    conn.commit()
    return row[0]


def finish_run(conn: psycopg.Connection, run_id: int, status: str, rows: int | None = None,
               error: str | None = None) -> None:
    conn.execute(
        "update pipeline_runs set finished_at = %s, status = %s, rows_written = %s, error = %s "
        "where id = %s",
        (now(), status, rows, error, run_id),
    )
    conn.commit()


def upsert_dataset(conn: psycopg.Connection, *, id: str, name: str, source_url: str,
                   license: str, attribution: str, cadence_hours: int,
                   notes: str | None = None) -> None:
    conn.execute(
        """insert into datasets (id, name, source_url, license, attribution, cadence_hours, notes)
           values (%s, %s, %s, %s, %s, %s, %s)
           on conflict (id) do update set name = excluded.name, source_url = excluded.source_url,
             license = excluded.license, attribution = excluded.attribution,
             cadence_hours = excluded.cadence_hours, notes = excluded.notes""",
        (id, name, source_url, license, attribution, cadence_hours, notes),
    )


def mark_attempt(conn: psycopg.Connection, dataset_id: str, status: str,
                 data_through: date | None = None, row_count: int | None = None) -> None:
    if status == "ok":
        conn.execute(
            """update datasets set last_attempt_at = %s, last_success_at = %s, last_status = 'ok',
                 data_through = %s, row_count = %s where id = %s""",
            (now(), now(), data_through, row_count, dataset_id),
        )
    else:
        # A failed run leaves the previous data and last_success_at untouched (spec 6.5).
        conn.execute(
            "update datasets set last_attempt_at = %s, last_status = %s where id = %s",
            (now(), status[:500], dataset_id),
        )


# ---------------------------------------------------------------- time series

def upsert_series(conn: psycopg.Connection, rows: Iterable[dict]) -> None:
    for r in rows:
        conn.execute(
            """insert into series (id, dataset_id, label, unit, country, sector, frequency,
                                   seasonal_adj, note)
               values (%(id)s, %(dataset_id)s, %(label)s, %(unit)s, %(country)s, %(sector)s,
                       %(frequency)s, %(seasonal_adj)s, %(note)s)
               on conflict (id) do update set label = excluded.label, unit = excluded.unit,
                 country = excluded.country, sector = excluded.sector,
                 frequency = excluded.frequency, seasonal_adj = excluded.seasonal_adj,
                 note = excluded.note""",
            {"note": None, "sector": None, "country": None, "seasonal_adj": None, **r},
        )


def replace_observations(conn: psycopg.Connection, rows: Iterable[tuple[str, date, float]]) -> int:
    """Upsert (series_id, date, value) rows. Idempotent: rerunning writes the same rows.

    Values revised by the source overwrite stored ones, which matters for Indeed:
    its seasonal adjustment revises history.
    """
    conn.execute(
        "create temp table if not exists obs_stage (series_id text, date date, value double precision)"
        " on commit drop"
    )
    n = 0
    with conn.cursor().copy("copy obs_stage (series_id, date, value) from stdin") as copy:
        for row in rows:
            copy.write_row(row)
            n += 1
    conn.execute(
        """insert into observations (series_id, date, value, ingested_at)
           select series_id, date, value, now() from obs_stage
           on conflict (series_id, date) do update set value = excluded.value,
             ingested_at = case when observations.value is distinct from excluded.value
                                then excluded.ingested_at else observations.ingested_at end"""
    )
    conn.execute("truncate obs_stage")
    return n


def jsonb(value) -> str:
    return json.dumps(value, separators=(",", ":"), default=str)
