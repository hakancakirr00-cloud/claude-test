"""CSV → SQLite içe aktarma yardımcısı.

Kullanım:
    python scripts/import_csv.py path/to/archive.csv
    python scripts/import_csv.py path/to/archive.csv --reset
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import load_config
from src.db import repository


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("csv", help="Aktarılacak CSV dosyası")
    p.add_argument("--reset", action="store_true", help="DB dosyasını silip baştan kur")
    args = p.parse_args()

    cfg = load_config()

    if args.reset and cfg.db_path.exists():
        cfg.db_path.unlink()

    repository.init_schema(cfg.db_path)
    n = repository.import_csv(cfg.db_path, Path(args.csv))
    total = repository.count_matches(cfg.db_path)
    print(f"İçe aktarıldı: {n} satır. Toplam arşiv: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
