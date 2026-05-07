"""
Lokal canlı bahis takip sunucusu.

Çalıştırma:
    python python/server.py

Ardından tarayıcıdan http://localhost:8000 adresini açın. Mevcut SPA
yüklenecek; "Canlı Takip" sekmesinden izleme listesini yönetebilir,
30 saniyelik aralıklarla güncellenen tabloda tetik koşulu sağlayan
maçları görsel olarak işaretlenmiş şekilde takip edebilirsiniz.

Sunucu yalnızca 127.0.0.1'e bind eder; LAN'a açılmaz, API anahtarınız
tarayıcıya hiç inmez.
"""

import os
import time
from typing import Optional

from flask import Flask, jsonify, request, send_from_directory

import config
import api_football


# Bahis tipleri için API-Football ID'leri.
# 5 = Goals Over/Under (tam maç) -> MS 1.5 Üst
# 6 = Goals Over/Under First Half -> İY 0.5 Üst
# API zaman zaman ID'leri yeniden numaralandırabildiği için "name" alanı
# substring eşleşmesi yedek olarak uygulanır.
BET_ID_OU_FT = 5
BET_ID_OU_FH = 6
BET_NAME_HINTS = {
    BET_ID_OU_FT: "goals over/under",
    BET_ID_OU_FH: "first half",
}


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))

# static_folder=repo kökü, static_url_path='' → root'tan itibaren
# tüm asset'ler doğrudan servis edilir (örn. /assets/css/styles.css).
app = Flask(
    __name__,
    static_folder=REPO_ROOT,
    static_url_path="",
)


# --- Basit TTL cache ---
# Aynı sorgu 25s içinde tekrar gelirse API'yi yormadan önbellekten cevap
# döner; sekmeyi yenileyip durmak veya birden fazla sekme açmak kotaya
# baskı yapmaz.
_CACHE_TTL_S = 25
_cache: dict[str, tuple[float, dict]] = {}


def _cache_get(key: str) -> Optional[dict]:
    entry = _cache.get(key)
    if not entry:
        return None
    ts, payload = entry
    if time.time() - ts > _CACHE_TTL_S:
        _cache.pop(key, None)
        return None
    return payload


def _cache_set(key: str, payload: dict) -> None:
    _cache[key] = (time.time(), payload)


# --- Tetik mantığı ---


def _extract_over_odd(
    odds_payload: dict, bet_id: int, line: float
) -> Optional[tuple[float, str]]:
    """
    Verilen odds payload'ı içinden istenen bahis (full match veya first
    half over/under) ve hat (0.5 / 1.5) için "Over" oranını ve
    bookmaker adını döndürür. Bulunamazsa None.
    """
    bookmakers = odds_payload.get("bookmakers") or []
    name_hint = BET_NAME_HINTS.get(bet_id, "")
    line_str = str(line)

    for bm in bookmakers:
        bm_name = bm.get("name", "?")
        for bet in bm.get("bets") or []:
            bet_name = (bet.get("name") or "").lower()
            id_match = bet.get("id") == bet_id
            name_match = name_hint and name_hint in bet_name
            if not (id_match or name_match):
                continue

            for value in bet.get("values") or []:
                v = str(value.get("value", "")).lower()
                handicap = str(value.get("handicap", ""))
                is_over = "over" in v
                is_correct_line = handicap == line_str or line_str in v
                if not (is_over and is_correct_line):
                    continue
                try:
                    odd = float(value.get("odd"))
                except (TypeError, ValueError):
                    continue
                return odd, bm_name

    return None


def _evaluate_trigger(
    fx: dict, odds_min: float, odds_max: float, min_elapsed: int
) -> Optional[dict]:
    """
    Tek bir maç için tetik kontrolü. Tetik düşerse market/oran/bookmaker
    içeren dict döndürür, aksi halde None.

    Filtreler:
      - status.short == "1H" (sadece ilk yarı)
      - status.elapsed >= min_elapsed
      - skor 0-0
      - "İY 0.5 Üst" veya "MS 1.5 Üst" oranı [odds_min, odds_max] içinde
    """
    status = (fx.get("fixture", {}).get("status") or {}).get("short")
    elapsed = (fx.get("fixture", {}).get("status") or {}).get("elapsed") or 0

    if status != "1H" or elapsed < min_elapsed:
        return None

    goals = fx.get("goals", {}) or {}
    if goals.get("home") != 0 or goals.get("away") != 0:
        return None

    fid = fx.get("fixture", {}).get("id")
    odds_payload = api_football.get_live_odds(fid)
    if not odds_payload:
        return None

    iy_over = _extract_over_odd(odds_payload, BET_ID_OU_FH, 0.5)
    ms_over = _extract_over_odd(odds_payload, BET_ID_OU_FT, 1.5)

    if iy_over and odds_min <= iy_over[0] <= odds_max:
        odd, bm = iy_over
        return {"market": "İY 0.5 Üst", "odd": odd, "bookmaker": bm}

    if ms_over and odds_min <= ms_over[0] <= odds_max:
        odd, bm = ms_over
        return {"market": "MS 1.5 Üst", "odd": odd, "bookmaker": bm}

    return None


def _shape_fixture(fx: dict, trigger: Optional[dict]) -> dict:
    """API-Football yanıtını UI'nin beklediği sade biçime indirger."""
    teams = fx.get("teams", {}) or {}
    fixture = fx.get("fixture", {}) or {}
    league = fx.get("league", {}) or {}
    status = fixture.get("status") or {}
    goals = fx.get("goals", {}) or {}
    return {
        "id": fixture.get("id"),
        "home": (teams.get("home") or {}).get("name", "?"),
        "away": (teams.get("away") or {}).get("name", "?"),
        "league": league.get("name", ""),
        "elapsed": status.get("elapsed"),
        "status": status.get("short"),
        "score": {
            "home": goals.get("home"),
            "away": goals.get("away"),
        },
        "trigger": trigger,
    }


# --- Routes ---


@app.route("/")
def index():
    return send_from_directory(REPO_ROOT, "index.html")


@app.route("/api/live")
def api_live():
    """
    Canlı maç ve (opsiyonel) tetik bilgisini birleşik döndürür.

    Query params:
      ids        (zorunlu, virgülle ayrılmış fixture ID listesi)
      withOdds   (varsayılan true) — tetik koşulu sağlayan maçlar için
                 odds çek ve yanıta ekle
      oddsMin    (varsayılan config.ODDS_MIN)
      oddsMax    (varsayılan config.ODDS_MAX)
      minElapsed (varsayılan config.MIN_ELAPSED)
    """
    raw_ids = (request.args.get("ids") or "").strip()
    ids: list[int] = []
    if raw_ids:
        for part in raw_ids.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                ids.append(int(part))
            except ValueError:
                pass

    if not ids:
        return jsonify({"fixtures": []})

    with_odds = (request.args.get("withOdds", "true").lower() == "true")

    try:
        odds_min = float(request.args.get("oddsMin", config.ODDS_MIN))
        odds_max = float(request.args.get("oddsMax", config.ODDS_MAX))
        min_elapsed = int(request.args.get("minElapsed", config.MIN_ELAPSED))
    except ValueError:
        return jsonify({"error": "Geçersiz parametre"}), 400

    cache_key = (
        f"live:{','.join(map(str, sorted(ids)))}:{with_odds}:"
        f"{odds_min}:{odds_max}:{min_elapsed}"
    )
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        live_fixtures = api_football.get_live_fixtures(ids)
        shaped: list[dict] = []
        for fx in live_fixtures:
            trigger = None
            if with_odds:
                trigger = _evaluate_trigger(
                    fx, odds_min, odds_max, min_elapsed
                )
            shaped.append(_shape_fixture(fx, trigger))

        payload = {"fixtures": shaped}
        _cache_set(cache_key, payload)
        return jsonify(payload)
    except Exception as exc:  # noqa: BLE001
        # Beklenmeyen bir hata UI'da "error" durumu olarak gösterilsin.
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    if not config.API_FOOTBALL_KEY:
        print(
            "[server] UYARI: API_FOOTBALL_KEY tanımlı değil. "
            ".env dosyanızı doldurun."
        )
    print("[server] http://127.0.0.1:8000 — durdurmak için Ctrl+C")
    app.run(host="127.0.0.1", port=8000, debug=False)
