from __future__ import annotations

from ..config import ScrapingConfig
from .base import OddsProvider, ProviderError
from .mackolik import MackolikProvider


def get_provider(cfg: ScrapingConfig) -> OddsProvider:
    name = (cfg.provider or "").lower()
    if name == "mackolik":
        return MackolikProvider(
            user_agent=cfg.user_agent,
            timeout_seconds=cfg.timeout_seconds,
            retries=cfg.retries,
        )
    raise ProviderError(f"Desteklenmeyen scraping provider: {cfg.provider}")
