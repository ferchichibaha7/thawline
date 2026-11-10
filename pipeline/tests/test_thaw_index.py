import pytest

from thawline.derive.thaw_index import combine, level_score, momentum_score, state_for


@pytest.mark.parametrize("index,score", [(60, 0), (50, 0), (110, 100), (130, 100), (100, 80),
                                         (85, 50)])
def test_level(index, score):
    assert level_score(index) == pytest.approx(score)


@pytest.mark.parametrize("change,score", [(-10, 0), (-25, 0), (0, 50), (10, 100), (4, 70)])
def test_momentum(change, score):
    assert momentum_score(change) == pytest.approx(score)


def test_combine_renormalises_missing_components():
    score, weights = combine({"level": 80, "momentum": 50, "breadth": None,
                              "entry_access": None, "competition": None})
    assert score == pytest.approx((80 * 35 + 50 * 25) / 60)
    assert weights == pytest.approx({"level": 35 / 60 * 100, "momentum": 25 / 60 * 100})
    assert sum(weights.values()) == pytest.approx(100)


def test_combine_needs_level_and_momentum():
    assert combine({"level": None, "momentum": 50})[0] is None
    assert combine({"level": 50, "momentum": None, "breadth": 90})[0] is None


def test_all_five_components():
    score, weights = combine({"level": 100, "momentum": 100, "breadth": 0, "entry_access": 0,
                              "competition": 0})
    assert score == pytest.approx(60)
    assert weights["breadth"] == pytest.approx(20)


@pytest.mark.parametrize("score,state", [(0, "Frozen"), (24.99, "Frozen"), (25, "Cold"),
                                         (49.9, "Cold"), (50, "Thawing"), (74.9, "Thawing"),
                                         (75, "Open"), (100, "Open")])
def test_states(score, state):
    assert state_for(score) == state
