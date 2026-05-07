"""
API-Football için ince HTTP sarmalayıcısı.

İki erişim biçimi de desteklenir:
  - Doğrudan api-sports.io (USE_RAPIDAPI=False)
  - RapidAPI üzerinden (USE_RAPIDAPI=True)

Tüm dış dünya çağrıları try/except ile sarılır; ağ veya API hatasında
None / boş liste döner ve ana döngü kesintisiz devam eder.
"""

import time
import requests

import config


# Host ve header'lar, kullanılan sağlayıcıya göre seçilir.
if config.USE_RAPIDAPI:
    _BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"
    _HEADERS = {
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
        "x-rapidapi-key": config.API_FOOTBALL_KEY,
    }
else:
    _BASE_URL = "https://v3.football.api-sports.io"
    _HEADERS = {
        "x-apisports-key": config.API_FOOTBALL_KEY,
    }

_TIMEOUT = 10  # saniye


def _get(path: str, params: dict | None = None) -> dict | None:
    """
    API-Football GET çağrısı. 5xx durumunda bir kez yeniden dener.
    Başarısızlıkta None döner ve hatayı log'a basar.
    """
    url = f"{_BASE_URL}{path}"
    for attempt in (1, 2):
        try:
            response = requests.get(
                url, headers=_HEADERS, params=params, timeout=_TIMEOUT
            )
            # Geçici sunucu hatasında bir kez daha dene.
            if 500 <= response.status_code < 600 and attempt == 1:
                time.sleep(1)
                continue
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            if attempt == 2:
                print(f"[api_football] {path} isteği başarısız: {exc}")
                return None
            time.sleep(1)
    return None


def get_live_fixtures(watch_ids: list[int]) -> list[dict]:
    """
    Şu an canlı oynanan tüm maçları çeker ve `watch_ids` filtresi ile
    döndürür. Tek istekle birden fazla maç için bilgi alınmış olur.
    Liste boş ise [] döner.
    """
    if not watch_ids:
        return []

    payload = _get("/fixtures", params={"live": "all"})
    if not payload:
        return []

    response = payload.get("response") or []
    watch_set = set(watch_ids)
    return [
        fx for fx in response
        if isinstance(fx, dict)
        and fx.get("fixture", {}).get("id") in watch_set
    ]


def get_live_odds(fixture_id: int) -> dict | None:
    """
    Belirli bir maç için canlı oran payload'ını döndürür. Bahis askıya
    alınmış (örn. gol anı) veya bookmaker yoksa None döner; bu çökme
    sebebi değildir, bir sonraki turda tekrar denenir.
    """
    payload = _get("/odds/live", params={"fixture": fixture_id})
    if not payload:
        return None

    response = payload.get("response") or []
    if not response:
        return None

    # Endpoint listenin ilk öğesi olarak ilgili maçın oran setini döner.
    return response[0]
