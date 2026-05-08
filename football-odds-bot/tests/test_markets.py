import pandas as pd

from src.analysis.markets import compute_hit_rates


def _row(ht_home, ht_away, ft_home, ft_away):
    return {
        "match_date": "2024-01-01", "league": "L", "home_team": "A", "away_team": "B",
        "ht_home": ht_home, "ht_away": ht_away, "ft_home": ft_home, "ft_away": ft_away,
    }


def test_compute_hit_rates_basic():
    df = pd.DataFrame([
        _row(1, 0, 2, 1),  # iy05 yes, ms15 yes, ms25 yes, btts yes
        _row(0, 0, 1, 0),  # iy05 no,  ms15 no,  ms25 no,  btts no
        _row(0, 1, 0, 2),  # iy05 yes, ms15 yes, ms25 no,  btts no
        _row(2, 0, 3, 0),  # iy05 yes, ms15 yes, ms25 yes, btts no
    ])
    h = compute_hit_rates(df)
    assert h["iy05_over"]["hits"] == 3 and h["iy05_over"]["n"] == 4
    assert h["ms15_over"]["hits"] == 3
    assert h["ms25_over"]["hits"] == 2
    assert h["btts_yes"]["hits"] == 1
    assert 0.0 <= h["iy05_over"]["wilson"] <= h["iy05_over"]["rate"]


def test_compute_hit_rates_empty():
    df = pd.DataFrame(columns=["ht_home", "ht_away", "ft_home", "ft_away"])
    h = compute_hit_rates(df)
    for k in ("iy05_over", "ms15_over", "ms25_over", "btts_yes"):
        assert h[k]["n"] == 0 and h[k]["hits"] == 0 and h[k]["rate"] == 0.0
