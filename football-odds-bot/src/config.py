from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class MatchingConfig:
    tolerance: float = 0.03
    use_close_odds: bool = True
    required_markets: list[str] = field(default_factory=list)
    match_keys: list[str] = field(default_factory=list)
    max_results: int = 5000
    min_sample: int = 5


@dataclass
class ScrapingConfig:
    provider: str = "mackolik"
    user_agent: str = "Mozilla/5.0"
    timeout_seconds: int = 15
    retries: int = 3


@dataclass
class AppConfig:
    telegram_token: str
    db_path: Path
    seed_csv: Path
    matching: MatchingConfig
    scraping: ScrapingConfig
    log_level: str = "INFO"


def load_config(config_path: Path | str | None = None) -> AppConfig:
    load_dotenv(PROJECT_ROOT / ".env", override=False)

    cfg_file = Path(config_path) if config_path else PROJECT_ROOT / "config.yaml"
    with cfg_file.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    token_env = raw["telegram"]["token_env"]
    token = os.environ.get(token_env, "")

    db_cfg = raw.get("database", {})
    db_path = (PROJECT_ROOT / db_cfg.get("path", "data/archive.db")).resolve()
    seed_csv = (PROJECT_ROOT / db_cfg.get("seed_csv", "data/seed_archive.csv")).resolve()

    m = raw.get("matching", {})
    matching = MatchingConfig(
        tolerance=float(m.get("tolerance", 0.03)),
        use_close_odds=bool(m.get("use_close_odds", True)),
        required_markets=list(m.get("required_markets", [])),
        match_keys=list(m.get("match_keys", [])),
        max_results=int(m.get("max_results", 5000)),
        min_sample=int(m.get("min_sample", 5)),
    )

    s = raw.get("scraping", {})
    scraping = ScrapingConfig(
        provider=s.get("provider", "mackolik"),
        user_agent=s.get("user_agent", "Mozilla/5.0"),
        timeout_seconds=int(s.get("timeout_seconds", 15)),
        retries=int(s.get("retries", 3)),
    )

    log_level = raw.get("logging", {}).get("level") or os.environ.get("LOG_LEVEL", "INFO")

    return AppConfig(
        telegram_token=token,
        db_path=db_path,
        seed_csv=seed_csv,
        matching=matching,
        scraping=scraping,
        log_level=log_level,
    )
