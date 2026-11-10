from datetime import date

import pandas as pd
import pytest

from thawline.sources import bls, fred, indeed


def test_indeed_aggregate_keeps_total_postings_sa(fixture_bytes):
    df = indeed.parse(fixture_bytes("indeed_aggregate_US_head.csv"), "aggregate", "US")
    assert list(df.columns) == ["date", "sector", "value"]
    assert df["sector"].isna().all()
    first = df.iloc[0]
    assert first["date"] == date(2020, 2, 1) and first["value"] == 100


def test_indeed_sector_parses_display_names(fixture_bytes):
    df = indeed.parse(fixture_bytes("indeed_sector_US_head.csv"), "sector", "US")
    assert set(df["sector"]) == {"Accounting"} or "Accounting" in set(df["sector"])
    assert (df["value"] > 0).all()
    # one row per day per sector: new postings rows are dropped
    assert not df.duplicated(["date", "sector"]).any()


def test_indeed_schema_drift_fails_loudly(fixture_bytes):
    raw = fixture_bytes("indeed_aggregate_US_head.csv").replace(b"variable", b"metric", 1)
    with pytest.raises(ValueError, match="columns changed"):
        indeed.parse(raw, "aggregate", "US")


def test_indeed_wrong_country_fails(fixture_bytes):
    with pytest.raises(ValueError, match="country"):
        indeed.parse(fixture_bytes("indeed_aggregate_US_head.csv"), "aggregate", "GB")


def test_series_ids_are_stable():
    assert indeed.series_id("US", "Software Development") == "indeed.US.software-development"
    assert indeed.series_id("GB", "IT Operations & Helpdesk") == "indeed.GB.it-operations-and-helpdesk"
    assert indeed.series_id("FR", None) == "indeed.FR.all"


def test_fred_csv_drops_blank_holidays(fixture_bytes):
    df = fred.parse_csv(fixture_bytes("fred_DGS10_tail.csv"), "DGS10")
    assert df["value"].notna().all()
    assert len(df) < 80  # holidays removed
    assert df["date"].is_monotonic_increasing


def test_bls_v1_response(fixture_bytes):
    df = bls.parse(fixture_bytes("bls_v1_response.json"))
    assert set(df["series_id"]) >= {"bls.CES6054150001", "bls.JTS510000000000000JOL"}
    assert all(d.day == 1 for d in df["date"])
    assert pd.api.types.is_float_dtype(df["value"])


def test_bls_failed_request_raises():
    with pytest.raises(RuntimeError):
        bls.parse(b'{"status": "REQUEST_NOT_PROCESSED", "message": ["daily threshold"]}')
