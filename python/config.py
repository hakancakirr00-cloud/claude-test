"""
Bot konfigürasyonu.

API anahtarları ve diğer hassas bilgiler `.env` dosyasından okunur
(`.env.example` dosyasını kopyalayıp doldurun). İzleme listesi ve
oran/dakika gibi davranışsal sabitler aşağıda doğrudan tanımlıdır.
"""

import os
from dotenv import load_dotenv

# .env dosyasını proje köküne göre yükle.
load_dotenv()


# --- API anahtarları ve hesap bilgileri (.env üzerinden) ---

# API-Football anahtarınızı .env dosyasındaki API_FOOTBALL_KEY alanına
# yazın. Hem doğrudan api-sports.io hem de RapidAPI üzerinden alınan
# anahtarlar destekleniyor (host ayrımı api_football.py içinde yapılır).
API_FOOTBALL_KEY: str = os.getenv("API_FOOTBALL_KEY", "")

# RapidAPI üzerinden kullanıyorsanız True yapın; doğrudan api-sports.io
# anahtarı kullanıyorsanız False bırakın.
USE_RAPIDAPI: bool = os.getenv("USE_RAPIDAPI", "false").lower() == "true"

# Telegram botunuzun token'ı (BotFather'dan alınır).
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

# Bildirimlerin gönderileceği chat ID. Kişisel sohbet için kendi
# user ID'niz, kanal/grup için kanalın chat ID'si.
TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")


# --- İzleme listesi ---

# Takip edilecek API-Football fixture ID'leri. Maç ID'sini almak için
# API-Football'un /fixtures endpoint'ini kullanabilirsiniz.
#
# Üretimde (örn. Railway) `WATCH_LIST` ortam değişkenini virgülle
# ayrılmış ID listesi olarak geçebilirsiniz (örn. "12345,67890").
# Env var verilmemişse aşağıdaki Python listesi kullanılır.
def _parse_watch_list_env() -> list[int]:
    raw = os.getenv("WATCH_LIST", "").strip()
    if not raw:
        return []
    ids: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.append(int(part))
        except ValueError:
            print(f"[config] WATCH_LIST içinde geçersiz ID atlandı: {part}")
    return ids


WATCH_LIST: list[int] = _parse_watch_list_env() or [
    # 1234567,
    # 7654321,
]


# --- Tetik parametreleri (gerektiğinde değiştirin) ---

# Sorgu döngüsünün her iterasyonu arasındaki bekleme süresi (saniye).
# UYARI: RapidAPI ücretsiz katmanı genelde ~100 istek/gün ile sınırlıdır.
# 60 saniyelik aralıkta günde ~1440 /fixtures?live=all isteği yapılır;
# /odds çağrıları ise yalnızca skor + dakika filtresinden geçen maçlar
# için yapılır. Kotanıza göre POLL_INTERVAL'i artırın.
POLL_INTERVAL: int = 60

# Tetik için minimum maç dakikası. Şartname "tam 10. dakika" diyor;
# pratikte poll aralığı nedeniyle "elapsed >= 10 ve henüz tetiklemedi"
# olarak değerlendirilir.
MIN_ELAPSED: int = 10

# Hedef oran aralığı (alt ve üst sınır dahil). Kullanıcı bu aralığı
# istediği gibi değiştirebilir.
ODDS_MIN: float = 1.45
ODDS_MAX: float = 1.60


# --- Çalıştırma modu ---

# True iken Telegram'a gerçek mesaj atılmaz; mesaj konsola basılır.
# Geliştirme/test için pratiktir.
DRY_RUN: bool = os.getenv("DRY_RUN", "false").lower() == "true"
