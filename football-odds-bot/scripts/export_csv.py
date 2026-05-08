"""SQLite → CSV dışa aktarma yardımcısı."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import load_config
from src.db import repository


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("out", help="Yazılacak CSV yolu")
    args = p.parse_args()

    cfg = load_config()
    with repository.connect(cfg.db_path) as conn:
        df = pd.read_sql_query("SELECT * FROM matches", conn)
    df.to_csv(args.out, index=False)
    print(f"{len(df)} satır {args.out} dosyasına yazıldı.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
