from datetime import date, timedelta

import numpy as np
import pytest

from thawline.models import forecast


def test_naive_and_drift():
    y = np.array([1.0, 2.0, 3.0])
    assert forecast.predict("naive", y, 2).tolist() == [3.0, 3.0]
    assert forecast.predict("drift", y, 2).tolist() == [4.0, 5.0]


def test_naive_mase_is_one_and_random_walk_rarely_ships():
    rng = np.random.default_rng(1)
    y = np.cumsum(rng.normal(0, 0.02, 260))
    bt = forecast.backtest(y)
    assert bt.mase["naive"][26] == pytest.approx(1.0)


def test_recovery_wording_branches():
    weeks = [date(2027, 1, 1) + timedelta(weeks=i) for i in range(104)]
    # every path crosses in week 10 -> a range
    paths = np.full((100, 104), 90.0)
    paths[:, 10:] = 101
    r = forecast.recovery(paths, weeks, latest=90)
    assert r["status"] == "range" and r["q20"] == weeks[10].isoformat() == r["q80"]
    # only 30% of paths cross -> earliest only
    paths = np.full((100, 104), 90.0)
    paths[:30, 50:] = 101
    r = forecast.recovery(paths, weeks, latest=90)
    assert r["status"] == "earliest" and r["q20"] == weeks[50].isoformat() and r["q80"] is None
    # nothing crosses
    r = forecast.recovery(np.full((100, 104), 90.0), weeks, latest=90)
    assert r["status"] == "none"
    # already above
    assert forecast.recovery(paths, weeks, latest=100)["status"] == "above"


def test_simulated_errors_grow_and_cover_two_years():
    rng = np.random.default_rng(0)
    errors = {o: np.cumsum(rng.normal(0, 0.01, 52 - (o % 3))) for o in range(14)}
    sims = forecast.simulate_errors(errors, 104, 500, 8, np.random.default_rng(2))
    assert sims.shape == (500, 104)
    assert sims[:, -1].std() > sims[:, 7].std()
