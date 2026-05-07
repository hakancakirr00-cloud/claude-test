"""
Canlı bahis takip ve Telegram bildirim botu.

Akış (her POLL_INTERVAL saniyede bir):
  1. WATCH_LIST'teki canlı maçlar API-Football'dan çekilir.
  2. Her maç için durum/dakika/skor kontrol edilir.
  3. 1H ve elapsed >= MIN_ELAPSED ve skor 0-0 ise canlı oranlar çekilir.
  4. "İY 0.5 Üst" veya "MS 1.5 Üst" oranlarından en az biri
     [ODDS_MIN, ODDS_MAX] aralığındaysa Telegram'a mesaj gönderilir.
  5. Aynı maç için bir daha tetik düşmemesi adına ID bir set'te tutulur.
"""

import time
from typing import Optional

import config
import api_football
from telegram_notifier import send_message


# API-Football'da bahis tipleri için kullanılan ID'ler. API zaman zaman
# bu ID'leri yeniden numaralandırabildiği için isim eşleşmesi de
# yedek olarak kullanılır (extract_over_odd içinde).
BET_ID_OU_FT = 5   # Goals Over/Under (tam maç) -> MS 1.5 Üst
BET_ID_OU_FH = 6   # Goals Over/Under First Half -> İY 0.5 Üst

# Bahis "name" alanı için yedek substring eşleşmeleri (case-insensitive).
BET_NAME_HINTS = {
    BET_ID_OU_FT: "goals over/under",
    BET_ID_OU_FH: "first half",
}

# Sadece 1H içinde tetikle. HT/2H/FT görüldüğünde maç "tamamlandı"
# kabul edilip notified set'e alınır ve bir daha sorgulanmaz.
ELIGIBLE_STATUS = "1H"
DEAD_STATUSES = {"HT", "2H", "ET", "BT", "P", "FT", "AET", "PEN",
                 "PST", "CANC", "ABD", "AWD", "WO", "SUSP", "INT"}

# Tetik düşen fixture'lar burada tutulur; bot yeniden başlarsa boşalır
# (kabul edilebilir: en kötü senaryo bir maç için bir duplike bildirim).
notified: set[int] = set()


def extract_over_odd(
    odds_payload: dict, bet_id: int, line: float
) -> Optional[tuple[float, str]]:
    """
    Verilen oran payload'ı içinden, istenen bet (Goals Over/Under
    full match veya first half) ve hat (örn. 0.5 / 1.5) için
    "Over" değerinin oranını ve bookmaker adını döndürür.

    Birden fazla bookmaker varsa ilk uygun olanı döndürür.
    Bulunamazsa None.
    """
    bookmakers = odds_payload.get("bookmakers") or []
    name_hint = BET_NAME_HINTS.get(bet_id, "")
    line_str = str(line)

    for bm in bookmakers:
        bm_name = bm.get("name", "?")
        for bet in bm.get("bets") or []:
            # 1) ID eşleşmesi, 2) yedek olarak name substring eşleşmesi.
            bet_name = (bet.get("name") or "").lower()
            id_match = bet.get("id") == bet_id
            name_match = name_hint and name_hint in bet_name
            if not (id_match or name_match):
                continue

            for value in bet.get("values") or []:
                v = str(value.get("value", "")).lower()
                handicap = str(value.get("handicap", ""))
                # "Over" + handicap eşleşmesi ya da "Over 1.5" gibi
                # tek alanda gelmiş bir biçim için hat numarasını ara.
                is_over = "over" in v
                is_correct_line = (
                    handicap == line_str or line_str in v
                )
                if not (is_over and is_correct_line):
                    continue

                try:
                    odd = float(value.get("odd"))
                except (TypeError, ValueError):
                    continue
                return odd, bm_name

    return None


def in_range(odd: float) -> bool:
    """Oran kullanıcının belirlediği aralıkta mı?"""
    return config.ODDS_MIN <= odd <= config.ODDS_MAX


def format_message(
    fx: dict, market_label: str, odd: float, bookmaker: str
) -> str:
    """Telegram mesajının HTML gövdesini hazırlar."""
    teams = fx.get("teams", {}) or {}
    home = teams.get("home", {}).get("name", "?")
    away = teams.get("away", {}).get("name", "?")
    league = (fx.get("league") or {}).get("name", "")

    fixture = fx.get("fixture", {}) or {}
    elapsed = (fixture.get("status") or {}).get("elapsed", "?")

    goals = fx.get("goals", {}) or {}
    score = f"{goals.get('home', 0)}-{goals.get('away', 0)}"

    return (
        f"<b>⚽ Canlı bahis tetiği</b>\n"
        f"<b>Maç:</b> {home} vs {away}\n"
        f"<b>Lig:</b> {league}\n"
        f"<b>Dakika:</b> {elapsed}'\n"
        f"<b>Skor:</b> {score}\n"
        f"<b>Market:</b> {market_label}\n"
        f"<b>Oran:</b> {odd:.2f} ({bookmaker})"
    )


def check_fixture(fx: dict) -> Optional[str]:
    """
    Tek bir maç için tüm filtreleri uygular.
    Tetik mesajını döndürür; tetik düşmediyse None döner.

    notified set'ine ekleme bu fonksiyon içinde değil, çağıran tarafta
    yapılır (mesaj başarıyla gönderildikten sonra). Tek istisnâ: maç
    artık uygun olamayacak duruma geldiğinde (skor bozuldu, dead status
    vb.) burada doğrudan set'e eklenir.
    """
    fixture = fx.get("fixture", {}) or {}
    fid = fixture.get("id")
    status = (fixture.get("status") or {}).get("short")
    elapsed = (fixture.get("status") or {}).get("elapsed") or 0

    # Maç ertelenmiş/iptal/bitmiş gibi durumlardaysa bir daha bakma.
    if status in DEAD_STATUSES:
        notified.add(fid)
        return None

    # Sadece ilk yarı içinde tetiklenir.
    if status != ELIGIBLE_STATUS:
        return None

    # 10. dakikadan önceyse henüz değil, set'e ekleme.
    if elapsed < config.MIN_ELAPSED:
        return None

    # Skor 0-0 değilse koşul kalıcı olarak bozuldu, bir daha bakma.
    goals = fx.get("goals", {}) or {}
    if goals.get("home") != 0 or goals.get("away") != 0:
        notified.add(fid)
        return None

    # Canlı oranları çek; bahis askıdaysa None gelir, bu turu atla
    # (bir sonraki turda tekrar denenebilsin diye notified'a ekleme).
    odds_payload = api_football.get_live_odds(fid)
    if not odds_payload:
        return None

    # İY 0.5 Üst ve MS 1.5 Üst için sırayla kontrol et.
    iy_over = extract_over_odd(odds_payload, BET_ID_OU_FH, 0.5)
    ms_over = extract_over_odd(odds_payload, BET_ID_OU_FT, 1.5)

    if iy_over and in_range(iy_over[0]):
        odd, bm = iy_over
        return format_message(fx, "İY 0.5 Üst", odd, bm)

    if ms_over and in_range(ms_over[0]):
        odd, bm = ms_over
        return format_message(fx, "MS 1.5 Üst", odd, bm)

    # Oranlar mevcut ama aralık dışında: bu maç için tetik bu turda
    # düşmedi; bir sonraki turda oranlar değişebilir, notified'a ekleme.
    return None


def poll_once() -> None:
    """Tek bir döngü iterasyonu — testten ve ana döngüden çağrılır."""
    if not config.WATCH_LIST:
        print("[bot] WATCH_LIST boş; config.py içine fixture ID ekleyin.")
        return

    fixtures = api_football.get_live_fixtures(config.WATCH_LIST)
    if not fixtures:
        # Şu an canlı oynayan izlenmiş maç yok; bilgi log'u.
        print("[bot] İzlenen maçlar arasında şu an canlı olan yok.")
        return

    for fx in fixtures:
        fid = (fx.get("fixture") or {}).get("id")
        if fid is None or fid in notified:
            continue
        try:
            message = check_fixture(fx)
        except Exception as exc:  # noqa: BLE001
            # Tek bir maçtaki ayrıştırma hatası diğerlerini etkilemesin.
            print(f"[bot] {fid} için kontrol hatası: {exc}")
            continue

        if message and send_message(message):
            notified.add(fid)


def main_loop() -> None:
    """Sonsuz döngü: poll → uyu → poll. Genel hatalar yutulur."""
    print(
        f"[bot] Başlatıldı. POLL_INTERVAL={config.POLL_INTERVAL}s, "
        f"watch={len(config.WATCH_LIST)} maç, DRY_RUN={config.DRY_RUN}"
    )
    while True:
        try:
            poll_once()
        except Exception as exc:  # noqa: BLE001
            print(f"[bot] döngü hatası: {exc}")
        time.sleep(config.POLL_INTERVAL)


if __name__ == "__main__":
    main_loop()
