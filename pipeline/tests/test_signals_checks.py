from datetime import date, timedelta

import pandas as pd
import pytest

from thawline import checks
from thawline.derive.signals import apply_cooldown, fmt_date, streak_lengths


def test_streak_lengths():
    s = pd.Series([1, 2, 3, 4, 3, 2, 2, 5])
    assert streak_lengths(s).tolist() == [0, 1, 2, 3, -1, -2, 0, 1]


def test_cooldown_keeps_one_per_28_days():
    base = date(2026, 1, 2)
    sigs = [{"kind": "streak", "subject_id": "x", "country": "US",
             "signal_date": base + timedelta(weeks=i)} for i in range(6)]
    kept = apply_cooldown(sigs, 28)
    assert [s["signal_date"] for s in kept] == [base, base + timedelta(weeks=4)]


def test_date_format():
    assert fmt_date(date(2026, 11, 6)) == "6 Nov 2026"


def frame(values, start=date(2026, 1, 1)):
    return pd.DataFrame({"series_id": "s", "date": [start + timedelta(days=i) for i in
                                                    range(len(values))], "value": values})


def test_checks_reject_future_dates():
    with pytest.raises(checks.DataCheckError, match="future"):
        checks.observations(frame([100], start=date.today() + timedelta(days=2)), label="t")


def test_checks_reject_out_of_range_and_duplicates():
    with pytest.raises(checks.DataCheckError, match="below"):
        checks.observations(frame([100, 4]), low=5, label="t")
    df = pd.concat([frame([100]), frame([100])])
    with pytest.raises(checks.DataCheckError, match="duplicate"):
        checks.observations(df, label="t")


def test_checks_reject_sudden_recent_jump():
    with pytest.raises(checks.DataCheckError, match="moved more than"):
        checks.observations(frame([100] * 60 + [140] * 7), label="t")
    checks.observations(frame([100 + i * 0.1 for i in range(70)]), label="t")
