from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class FetchResult:
    """Normalised odds payload returned by every OddsProvider.

    Required keys for matching: ms1_open, msx_open, ms2_open,
    ou25_over_open, iy05_over_open, btts_yes_open. Close fields optional.
    """
    home_team: str
    away_team: str
    league: str
    match_date: str
    odds: dict[str, float]
    raw: dict | None = None

    def as_target(self) -> dict:
        return {
            "home_team": self.home_team,
            "away_team": self.away_team,
            "league": self.league,
            "match_date": self.match_date,
            **self.odds,
        }


class OddsProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def fetch(self, match_url_or_id: str) -> FetchResult:
        """Fetch live opening + closing odds for the given match URL or ID."""
        raise NotImplementedError


class ProviderError(RuntimeError):
    """Raised when the upstream provider can't be reached or parsed."""
