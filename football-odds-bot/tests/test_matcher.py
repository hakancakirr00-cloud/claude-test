from pathlib import Path

import pandas as pd
import pytest

from src.analysis.matcher import find_similar

FIXTURE = Path(__file__).parent / "fixtures" / "sample_archive.csv"


@pytest.fixture()
def archive() -> pd.DataFrame:
    return pd.read_csv(FIXTURE)


def test_band_matches_similar_rows(archive):
    target = {"ms1_open": 1.57, "ou25_over_open": 1.65}
    out = find_similar(archive, target, tolerance=0.03)
    # 1.57 ± %3 = [1.5229, 1.6171] → L1 satırlarının çoğu girer; L2 düşer.
    assert len(out) >= 4
    assert (out["league"] == "L1").all()


def test_tighter_tolerance_shrinks_pool(archive):
    target = {"ms1_open": 1.57}
    wide = find_similar(archive, target, tolerance=0.05)
    tight = find_similar(archive, target, tolerance=0.005)
    assert len(tight) <= len(wide)


def test_none_target_is_wildcard(archive):
    target = {"ms1_open": None, "ou25_over_open": 1.65}
    out = find_similar(archive, target, tolerance=0.03)
    assert not out.empty


def test_no_applicable_keys_returns_empty(archive):
    out = find_similar(archive, {}, tolerance=0.03)
    assert out.empty


def test_unknown_key_is_ignored(archive):
    target = {"foo_bar": 1.5, "ms1_open": 1.57}
    out = find_similar(archive, target, tolerance=0.03, match_keys=["foo_bar", "ms1_open"])
    assert not out.empty
