from __future__ import annotations

from typing import Callable

import pandas as pd

from .confidence import wilson_lower


MARKET_LABELS: dict[str, str] = {
    "iy05_over": "İY 0.5 Üst",
    "ms15_over": "MS 1.5 Üst",
    "ms25_over": "MS 2.5 Üst",
    "btts_yes": "KG Var",
}


def _market_mask(df: pd.DataFrame, market: str) -> pd.Series:
    if market == "iy05_over":
        return (df["ht_home"].fillna(0) + df["ht_away"].fillna(0)) >= 1
    if market == "ms15_over":
        return (df["ft_home"].fillna(0) + df["ft_away"].fillna(0)) >= 2
    if market == "ms25_over":
        return (df["ft_home"].fillna(0) + df["ft_away"].fillna(0)) >= 3
    if market == "btts_yes":
        return (df["ft_home"].fillna(0) >= 1) & (df["ft_away"].fillna(0) >= 1)
    raise ValueError(f"Bilinmeyen pazar: {market}")


def compute_hit_rates(matches: pd.DataFrame) -> dict[str, dict]:
    """Returns {market_key: {label, n, hits, rate, wilson}} for the four target markets."""
    out: dict[str, dict] = {}
    n = int(len(matches))
    for key, label in MARKET_LABELS.items():
        if n == 0:
            out[key] = {"label": label, "n": 0, "hits": 0, "rate": 0.0, "wilson": 0.0}
            continue
        mask = _market_mask(matches, key)
        hits = int(mask.sum())
        out[key] = {
            "label": label,
            "n": n,
            "hits": hits,
            "rate": hits / n,
            "wilson": wilson_lower(hits, n),
        }
    return out


def score_breakdown(matches: pd.DataFrame, limit: int = 10) -> list[dict]:
    """Latest matches with score recap, used by the report."""
    if matches.empty:
        return []
    df = matches.sort_values("match_date", ascending=False).head(limit)
    rows: list[dict] = []
    for _, r in df.iterrows():
        rows.append(
            {
                "match_date": r.get("match_date"),
                "league": r.get("league"),
                "home_team": r.get("home_team"),
                "away_team": r.get("away_team"),
                "ht": f"{int(r['ht_home']) if pd.notna(r['ht_home']) else '-'}-"
                      f"{int(r['ht_away']) if pd.notna(r['ht_away']) else '-'}",
                "ft": f"{int(r['ft_home']) if pd.notna(r['ft_home']) else '-'}-"
                      f"{int(r['ft_away']) if pd.notna(r['ft_away']) else '-'}",
            }
        )
    return rows
