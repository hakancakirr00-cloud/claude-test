CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  match_date      TEXT    NOT NULL,
  league          TEXT    NOT NULL,
  home_team       TEXT    NOT NULL,
  away_team       TEXT    NOT NULL,
  ht_home         INTEGER,
  ht_away         INTEGER,
  ft_home         INTEGER,
  ft_away         INTEGER,

  ms1_open        REAL, ms1_close   REAL,
  msx_open        REAL, msx_close   REAL,
  ms2_open        REAL, ms2_close   REAL,

  ou15_over_open  REAL, ou15_over_close  REAL,
  ou15_under_open REAL, ou15_under_close REAL,
  ou25_over_open  REAL, ou25_over_close  REAL,
  ou25_under_open REAL, ou25_under_close REAL,

  iy05_over_open  REAL, iy05_over_close  REAL,
  iy05_under_open REAL, iy05_under_close REAL,

  btts_yes_open   REAL, btts_yes_close   REAL,
  btts_no_open    REAL, btts_no_close    REAL,

  ah_data         TEXT,
  source          TEXT,
  inserted_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_league     ON matches(league);
CREATE INDEX IF NOT EXISTS idx_ms1_open   ON matches(ms1_open);
CREATE INDEX IF NOT EXISTS idx_ou25_open  ON matches(ou25_over_open);
CREATE INDEX IF NOT EXISTS idx_iy05_open  ON matches(iy05_over_open);
