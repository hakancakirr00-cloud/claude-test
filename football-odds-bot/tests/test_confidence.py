from src.analysis.confidence import wilson_lower


def test_zero_n():
    assert wilson_lower(0, 0) == 0.0


def test_perfect_small_sample_is_pessimistic():
    # 5/5 => Wilson alt sınır 1.0'dan belirgin küçük olmalı
    w = wilson_lower(5, 5)
    assert 0.4 < w < 0.85


def test_known_value_matches_js_port():
    # 8/10 için JS portuyla birebir aynı (~0.488).
    w = wilson_lower(8, 10)
    assert abs(w - 0.4878) < 0.005


def test_monotonic_in_n():
    # n büyüdükçe (aynı oranda) Wilson alt sınırı artmalı
    a = wilson_lower(8, 10)
    b = wilson_lower(80, 100)
    assert b > a
