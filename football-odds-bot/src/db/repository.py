from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable, Mapping

import pandas as pd

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

ODDS_COLUMNS = [
    "ms1_open", "ms1_close", "msx_open", "msx_close", "ms2_open", "ms2_close",
    "ou15_over_open", "ou15_over_close", "ou15_under_open", "ou15_under_close",
    "ou25_over_open", "ou25_over_close", "ou25_under_open", "ou25_under_close",
    "iy05_over_open", "iy05_over_close", "iy05_under_open", "iy05_under_close",
    "btts_yes_open", "btts_yes_close", "btts_no_open", "btts_no_close",
]

ALL_COLUMNS = [
    "match_date", "league", "home_team", "away_team",
    "ht_home", "ht_away", "ft_home", "ft_away",
    *ODDS_COLUMNS,
    "ah_data", "source",
]


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(db_path: Path) -> None:
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with connect(db_path) as conn:
        conn.executescript(sql)
        conn.commit()


def insert_matches(db_path: Path, rows: Iterable[Mapping]) -> int:
    rows = list(rows)
    if not rows:
        return 0
    cols = ALL_COLUMNS
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT INTO matches ({','.join(cols)}) VALUES ({placeholders})"
    values = [tuple(r.get(c) for c in cols) for r in rows]
    with connect(db_path) as conn:
        conn.executemany(sql, values)
        conn.commit()
    return len(values)


def import_csv(db_path: Path, csv_path: Path) -> int:
    df = pd.read_csv(csv_path)
    df = df.where(pd.notnull(df), None)
    rows = df.to_dict(orient="records")
    return insert_matches(db_path, rows)


def load_archive(
    db_path: Path,
    target: Mapping[str, float] | None = None,
    tolerance: float = 0.03,
    league: str | None = None,
) -> pd.DataFrame:
    """Pre-filter at SQL level using ±tolerance bands; precise matching is done in matcher.py."""
    where: list[str] = []
    params: list[object] = []

    if league:
        where.append("league = ?")
        params.append(league)

    if target:
        for k, v in target.items():
            if k not in ODDS_COLUMNS or v is None:
                continue
            try:
                v = float(v)
            except (TypeError, ValueError):
                continue
            lo, hi = v * (1 - tolerance), v * (1 + tolerance)
            where.append(f"{k} BETWEEN ? AND ?")
            params.extend([lo, hi])

    sql = "SELECT * FROM matches"
    if where:
        sql += " WHERE " + " AND ".join(where)

    with connect(db_path) as conn:
        return pd.read_sql_query(sql, conn, params=params)


def count_matches(db_path: Path) -> int:
    with connect(db_path) as conn:
        cur = conn.execute("SELECT COUNT(*) FROM matches")
        return int(cur.fetchone()[0])
