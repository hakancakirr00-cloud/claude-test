from __future__ import annotations

from typing import Iterable, Mapping

import pandas as pd

from ..db.repository import ODDS_COLUMNS


def _coerce_float(v) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if pd.isna(f):
        return None
    return f


def find_similar(
    archive_df: pd.DataFrame,
    target: Mapping[str, float],
    tolerance: float = 0.03,
    match_keys: Iterable[str] | None = None,
    max_results: int = 5000,
) -> pd.DataFrame:
    """Return rows whose every numeric odds key in `target` falls within ±tolerance band.

    - Keys not in ODDS_COLUMNS are ignored.
    - Keys whose target value is None/NaN are skipped (treated as wildcard).
    - If `match_keys` is provided, only those columns are used for matching.
    """
    if archive_df.empty:
        return archive_df

    keys = list(match_keys) if match_keys else list(target.keys())
    mask = pd.Series(True, index=archive_df.index)
    used = 0

    for k in keys:
        if k not in ODDS_COLUMNS or k not in archive_df.columns:
            continue
        v = _coerce_float(target.get(k))
        if v is None:
            continue
        lo = v * (1.0 - tolerance)
        hi = v * (1.0 + tolerance)
        col = pd.to_numeric(archive_df[k], errors="coerce")
        mask &= col.between(lo, hi, inclusive="both")
        used += 1

    if used == 0:
        return archive_df.iloc[0:0]

    out = archive_df[mask]
    if len(out) > max_results:
        out = out.head(max_results)
    return out


def applicable_keys(target: Mapping[str, float]) -> list[str]:
    return [k for k in target.keys() if k in ODDS_COLUMNS and _coerce_float(target.get(k)) is not None]
