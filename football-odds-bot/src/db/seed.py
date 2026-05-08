from __future__ import annotations

import logging
from pathlib import Path

from . import repository

log = logging.getLogger(__name__)


def init_db(db_path: Path, seed_csv: Path | None = None) -> None:
    fresh = not db_path.exists()
    repository.init_schema(db_path)

    if fresh and seed_csv and seed_csv.exists():
        n = repository.import_csv(db_path, seed_csv)
        log.info("Seeded %d matches from %s", n, seed_csv)
    else:
        existing = repository.count_matches(db_path)
        log.info("Archive ready at %s (%d matches)", db_path, existing)
