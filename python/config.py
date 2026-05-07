"""
Sunucu konfigürasyonu.

Hassas bilgiler `.env` dosyasından okunur (`.env.example`'ı kopyalayıp
doldurun). Tetik parametreleri aşağıda doğrudan tanımlıdır.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# --- API kimlik bilgileri (.env üzerinden) ---

# API-Football anahtarınızı .env'deki API_FOOTBALL_KEY alanına yazın.
# Hem doğrudan api-sports.io hem RapidAPI üzerinden alınmış anahtarlar
# desteklenir; host ayrımı USE_RAPIDAPI ile yapılır.
API_FOOTBALL_KEY: str = os.getenv("API_FOOTBALL_KEY", "")

# RapidAPI üzerinden anahtar aldıysanız True yapın.
USE_RAPIDAPI: bool = os.getenv("USE_RAPIDAPI", "false").lower() == "true"


# --- Tetik parametreleri (varsayılan değerler; UI tarafından override edilir) ---

# Tetik için minimum maç dakikası.
MIN_ELAPSED: int = 10

# Hedef oran aralığı (alt ve üst sınır dahil).
ODDS_MIN: float = 1.45
ODDS_MAX: float = 1.60
