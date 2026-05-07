# Canlı Takip Sunucusu

Tarayıcıdaki "Canlı Takip" sekmesini besleyen lokal Flask sunucusu.
Sadece `127.0.0.1`'e bind eder; API anahtarınız tarayıcıya inmez.

## Kurulum

```bash
cd /path/to/claude-test
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r python/requirements.txt
cp python/.env.example python/.env  # değerleri doldur
```

`python/.env` içine API-Football anahtarınızı yazın:

```
API_FOOTBALL_KEY=anahtarınız
USE_RAPIDAPI=false
```

## Çalıştırma

```bash
python python/server.py
```

Tarayıcıdan **http://localhost:8000** adresini açın → üst menüden
"Canlı Takip" sekmesine geçin.

## Kullanım

1. Üst formdan takip etmek istediğiniz fixture ID'lerini ekleyin
   (ID'leri API-Football'un `/fixtures` endpoint'inden alabilirsiniz).
2. Liste 30 saniyede bir otomatik yenilenir.
3. Bir maçın 10. dakikasında skor 0-0 ve oran aralığı koşulu
   sağlanırsa satır yeşil bir vurgu ile öne çıkar.
4. Oran aralığını üst formdan değiştirebilirsiniz.

## Notlar

- İzleme listesi ve oran aralığı tarayıcı `localStorage`'ında tutulur;
  sunucuyu yeniden başlatmak listeyi etkilemez.
- API-Football ücretsiz katmanı ~100 istek/gün ile sınırlıdır.
  Sunucu 25 saniyelik bir TTL cache uygular; aynı sorgu peş peşe
  yapılırsa API'ye gitmez.
- Sunucuyu kapattığınızda dashboard "Sunucu kapalı" rozeti gösterir
  ve geri açıldığında otomatik bağlanır.
