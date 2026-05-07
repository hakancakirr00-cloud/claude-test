"""
Telegram Bot API üzerinden basit mesaj gönderim sarmalayıcısı.

DRY_RUN aktifken gerçek istek atılmaz, mesaj konsola basılır; bu sayede
gerçek bir kanala yanlışlıkla mesaj atmadan tetik mantığını test
edebilirsiniz.
"""

import requests

import config


_TIMEOUT = 10  # saniye
_API_URL = "https://api.telegram.org/bot{token}/sendMessage"


def send_message(text: str) -> bool:
    """
    Telegram'a mesaj gönderir. Başarılıysa True, aksi hâlde False döner.
    Ağ veya API hatası ana döngüyü kırmaz.
    """
    if config.DRY_RUN:
        # Gerçek istek atılmaz; mesaj sadece konsola yazılır.
        print("[DRY_RUN telegram] " + text)
        return True

    if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
        print("[telegram] Token veya chat_id eksik, mesaj atılamadı.")
        return False

    url = _API_URL.format(token=config.TELEGRAM_BOT_TOKEN)
    data = {
        "chat_id": config.TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        # Önizlemeyi kapatarak mesajı sade tutar.
        "disable_web_page_preview": True,
    }
    try:
        response = requests.post(url, data=data, timeout=_TIMEOUT)
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        print(f"[telegram] gönderim hatası: {exc}")
        return False
