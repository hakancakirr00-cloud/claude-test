from __future__ import annotations

import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

from .base import FetchResult, OddsProvider, ProviderError

log = logging.getLogger(__name__)


class MackolikProvider(OddsProvider):
    """Mackolik HTML scraper.

    NOTE: Mackolik sayfa yapısı değiştiğinde CSS seçicileri güncellenmelidir.
    Bu sınıf temel iskelet sağlar — gerçek prod kullanımda seçicileri
    canlı sayfa üzerinden teyit edip ince ayar yapın.
    """

    name = "mackolik"

    def __init__(self, user_agent: str, timeout_seconds: int = 15, retries: int = 3):
        self.user_agent = user_agent
        self.timeout = timeout_seconds
        self.retries = retries

    async def fetch(self, match_url_or_id: str) -> FetchResult:
        url = self._normalise_url(match_url_or_id)
        html = await self._download(url)
        return self._parse(html, url)

    def _normalise_url(self, value: str) -> str:
        if value.startswith("http"):
            return value
        if value.isdigit():
            return f"https://arsiv.mackolik.com/Match/Default.aspx?id={value}"
        raise ProviderError(f"Geçersiz Mackolik girdisi: {value}")

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
    )
    async def _download(self, url: str) -> str:
        headers = {"User-Agent": self.user_agent, "Accept-Language": "tr-TR,tr;q=0.9"}
        async with httpx.AsyncClient(timeout=self.timeout, headers=headers, follow_redirects=True) as client:
            r = await client.get(url)
            if r.status_code >= 400:
                raise ProviderError(f"Mackolik HTTP {r.status_code} for {url}")
            return r.text

    def _parse(self, html: str, url: str) -> FetchResult:
        soup = BeautifulSoup(html, "lxml")
        try:
            home, away = self._teams(soup)
            league = self._league(soup)
            match_date = self._match_date(soup)
            odds = self._odds_table(soup)
        except Exception as e:
            raise ProviderError(f"Mackolik parse hatası ({url}): {e}") from e

        if not odds:
            raise ProviderError(f"Mackolik oran tablosu boş döndü: {url}")

        return FetchResult(
            home_team=home,
            away_team=away,
            league=league,
            match_date=match_date,
            odds=odds,
            raw={"url": url},
        )

    def _teams(self, soup: BeautifulSoup) -> tuple[str, str]:
        home = (soup.select_one(".team-home, .home-team, .h-team") or {}).get_text(strip=True) if soup.select_one(".team-home, .home-team, .h-team") else ""
        away = (soup.select_one(".team-away, .away-team, .a-team") or {}).get_text(strip=True) if soup.select_one(".team-away, .away-team, .a-team") else ""
        if not home or not away:
            title = (soup.title.string if soup.title else "") or ""
            m = re.search(r"(.+?)\s*-\s*(.+?)\s*(?:Maç|Mac|maç|–|\|)", title)
            if m:
                home, away = m.group(1).strip(), m.group(2).strip()
        return home or "?", away or "?"

    def _league(self, soup: BeautifulSoup) -> str:
        el = soup.select_one(".match-league, .league-name, .breadcrumb a:last-child")
        return el.get_text(strip=True) if el else "?"

    def _match_date(self, soup: BeautifulSoup) -> str:
        el = soup.select_one(".match-date, time, .date")
        if el:
            txt = el.get_text(strip=True)
            m = re.search(r"(\d{4})-(\d{2})-(\d{2})", txt) or re.search(r"(\d{2})\.(\d{2})\.(\d{4})", txt)
            if m:
                if "-" in txt:
                    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
                return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
        return ""

    def _odds_table(self, soup: BeautifulSoup) -> dict[str, float]:
        """Map Mackolik odds rows to our schema keys.

        Strategy: locate the odds table, walk its rows, and extract opening/closing
        cells per market. The exact selectors below are illustrative; tune them
        against the live HTML when integrating.
        """
        odds: dict[str, float] = {}

        ms_rows = soup.select("table.odds-1x2 tr")
        for row in ms_rows:
            cells = [c.get_text(strip=True) for c in row.select("td")]
            if len(cells) < 4:
                continue
            label = cells[0].lower()
            opens = self._to_float(cells[1])
            closes = self._to_float(cells[2])
            if "ms1" in label or label == "1":
                odds["ms1_open"], odds["ms1_close"] = opens, closes
            elif "msx" in label or label in ("x", "0"):
                odds["msx_open"], odds["msx_close"] = opens, closes
            elif "ms2" in label or label == "2":
                odds["ms2_open"], odds["ms2_close"] = opens, closes

        for row in soup.select("table.odds-ou tr"):
            cells = [c.get_text(strip=True) for c in row.select("td")]
            if len(cells) < 4:
                continue
            label = cells[0].lower()
            opens = self._to_float(cells[1])
            closes = self._to_float(cells[2])
            if "2.5 üst" in label or "2.5 ust" in label or "over 2.5" in label:
                odds["ou25_over_open"], odds["ou25_over_close"] = opens, closes
            elif "2.5 alt" in label or "under 2.5" in label:
                odds["ou25_under_open"], odds["ou25_under_close"] = opens, closes
            elif "1.5 üst" in label or "over 1.5" in label:
                odds["ou15_over_open"], odds["ou15_over_close"] = opens, closes
            elif "1.5 alt" in label or "under 1.5" in label:
                odds["ou15_under_open"], odds["ou15_under_close"] = opens, closes

        for row in soup.select("table.odds-iy05 tr, table.odds-htou tr"):
            cells = [c.get_text(strip=True) for c in row.select("td")]
            if len(cells) < 4:
                continue
            label = cells[0].lower()
            opens = self._to_float(cells[1])
            closes = self._to_float(cells[2])
            if "iy 0.5 üst" in label or "ht over 0.5" in label:
                odds["iy05_over_open"], odds["iy05_over_close"] = opens, closes
            elif "iy 0.5 alt" in label or "ht under 0.5" in label:
                odds["iy05_under_open"], odds["iy05_under_close"] = opens, closes

        for row in soup.select("table.odds-btts tr, table.odds-kg tr"):
            cells = [c.get_text(strip=True) for c in row.select("td")]
            if len(cells) < 4:
                continue
            label = cells[0].lower()
            opens = self._to_float(cells[1])
            closes = self._to_float(cells[2])
            if "kg var" in label or "btts yes" in label:
                odds["btts_yes_open"], odds["btts_yes_close"] = opens, closes
            elif "kg yok" in label or "btts no" in label:
                odds["btts_no_open"], odds["btts_no_close"] = opens, closes

        return {k: v for k, v in odds.items() if v is not None}

    @staticmethod
    def _to_float(s: str) -> float | None:
        if not s:
            return None
        s = s.replace(",", ".").strip()
        try:
            return float(s)
        except ValueError:
            return None
