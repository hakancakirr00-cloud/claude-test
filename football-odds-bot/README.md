# Futbol Oran Analiz ve Filtreleme Botu

Telegram tabanlı bir futbol oran analiz botu. Kullanıcı bota bir maç linki/ID gönderir; bot anlık açılış–kapanış oranlarını kazır, geçmiş arşivde **±tolerans bantlı** eşleşen maçları bulur ve aşağıdaki dört pazar için yüzdesel tahmin + örnek skorlar döndürür:

- İY 0.5 Üst
- MS 1.5 Üst
- MS 2.5 Üst
- KG Var

İstatistiksel güven göstergesi olarak **Wilson skor aralığı alt sınırı** kullanılır (küçük örneklemde tahmin oranını ihtiyatlı çeker).

## Mimari

```
src/
├── main.py              # Telegram giriş noktası
├── config.py            # config.yaml + .env yükleyici
├── db/
│   ├── schema.sql       # SQLite tablo + indeksler
│   ├── repository.py    # Pandas dönüşlü okuma/yazma
│   └── seed.py          # ilk açılışta seed CSV ile doldurma
├── scraping/
│   ├── base.py          # OddsProvider ABC + FetchResult
│   ├── mackolik.py      # Mackolik scraper (httpx + bs4)
│   └── factory.py       # config'e göre provider seçimi
├── analysis/
│   ├── matcher.py       # tolerans bantlı vektörize eşleşme
│   ├── markets.py       # pazar isabet hesaplayıcıları
│   ├── confidence.py    # Wilson alt sınırı
│   └── report.py        # Telegram Markdown raporu
└── bot/
    ├── parser.py        # mesajdan link/ID çıkar
    ├── handlers.py      # /start /help /stats + on_message
    └── formatter.py
```

## Kurulum

```bash
cd football-odds-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# (opsiyonel — oddsportal Playwright tabanlı eklemek istersen)
playwright install chromium

cp .env.example .env
# .env'yi düzenle: TELEGRAM_TOKEN=...
```

## Veri tabanını seed et

İlk çalışmada `data/seed_archive.csv` otomatik içe aktarılır. Kendi arşivini yüklemek için:

```bash
python scripts/import_csv.py path/to/your_archive.csv --reset
```

CSV başlıkları için `data/seed_archive.csv` örnek alınmalıdır (30+ kolon: tarih, lig, takımlar, skorlar, MS1/X/2 açılış–kapanış, OU 1.5/2.5, İY 0.5, KG).

## Botu çalıştır

```bash
python -m src.main
```

Telegram'da bota:

```
https://arsiv.mackolik.com/Match/Default.aspx?id=123456
```

ya da sadece sayısal ID gönder. Yanıt:

```
⚽ Bayern vs Dortmund
🏆 Bundesliga  •  📅 2026-05-10

🎯 Eşleşen maç sayısı: 24  (tolerans ±3.0%)

📊 Pazar tahminleri (Wilson alt sınır)
• MS 1.5 Üst   91.7%  •  güven 75.4%  (22/24)
• MS 2.5 Üst   79.2%  •  güven 60.0%  (19/24)
• İY 0.5 Üst   87.5%  •  güven 70.1%  (21/24)
• KG Var       70.8%  •  güven 51.6%  (17/24)

🔑 Eşleşmede kullanılan oranlar: ms1_open, ms1_close, ou25_over_open, iy05_over_open, btts_yes_open

🕘 Son 5 benzer maç
• 2024-03-12  Bayern 3-1 Frankfurt  (İY 1-0)
...
```

## Konfigürasyon (`config.yaml`)

| Anahtar | Açıklama |
|---|---|
| `matching.tolerance` | Oran karşılaştırma bant genişliği (varsayılan 0.03 = ±3%) |
| `matching.match_keys` | Eşleşmede kullanılacak oran sütunları (örn. `ms1_open`, `ou25_over_open`) |
| `matching.max_results` | DataFrame boyut sınırı |
| `matching.min_sample` | Bu örneklem altına düşersek raporda uyarı |
| `scraping.provider` | `mackolik` (genişletilebilir) |

## Test

```bash
pytest -q
```

11 birim testi: Wilson lower bound (JS portuyla doğrulanmış), pazar isabet hesaplayıcıları ve tolerans bantlı eşleşme.

## Notlar

- Mackolik scraper'ı temel iskelet sağlar; kullanılan CSS seçicilerini canlı sayfa yapısına göre ince ayarlamak gerekebilir. Provider arayüzü (`OddsProvider`) sayesinde Sahadan/OddsPortal eklemek tek dosyalık iş.
- Yasal/etik uyarı: Web scraping yaparken hedef sitelerin `robots.txt` kurallarına ve hizmet şartlarına uyun.
