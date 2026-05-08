from __future__ import annotations

from typing import Mapping

import pandas as pd

from .markets import score_breakdown


def _pct(x: float) -> str:
    return f"{x * 100:5.1f}%"


def build_report(
    target: Mapping[str, float | str | None],
    matches_df: pd.DataFrame,
    hit_rates: dict[str, dict],
    used_keys: list[str],
    tolerance: float,
    min_sample: int = 5,
) -> str:
    """Telegram-friendly Markdown report."""
    home = target.get("home_team") or "?"
    away = target.get("away_team") or "?"
    league = target.get("league") or "?"
    md = target.get("match_date") or "?"

    n = int(len(matches_df))

    lines: list[str] = []
    lines.append(f"⚽ *{home}* vs *{away}*")
    lines.append(f"🏆 {league}  •  📅 {md}")
    lines.append("")
    lines.append(f"🎯 Eşleşen maç sayısı: *{n}*  (tolerans ±{tolerance * 100:.1f}%)")

    if n == 0:
        lines.append("")
        lines.append("⚠️ Geçmiş arşivde benzer oran kombinasyonu bulunamadı.")
        lines.append("Toleransı genişletmeyi (örn. ±5%) veya farklı pazar anahtarları kullanmayı deneyin.")
        return "\n".join(lines)

    if n < min_sample:
        lines.append(f"⚠️ Örneklem küçük (n<{min_sample}); yüzdeler düşük güvende.")

    lines.append("")
    lines.append("📊 *Pazar tahminleri* _(Wilson alt sınır)_")
    for key in ("ms15_over", "ms25_over", "iy05_over", "btts_yes"):
        m = hit_rates.get(key)
        if not m:
            continue
        lines.append(
            f"• {m['label']:<11} {_pct(m['rate'])}  •  güven {_pct(m['wilson'])}  ({m['hits']}/{m['n']})"
        )

    if used_keys:
        lines.append("")
        lines.append("🔑 Eşleşmede kullanılan oranlar: " + ", ".join(used_keys))

    breakdown = score_breakdown(matches_df, limit=5)
    if breakdown:
        lines.append("")
        lines.append("🕘 *Son 5 benzer maç*")
        for r in breakdown:
            lines.append(
                f"• {r['match_date']}  {r['home_team']} {r['ft']} {r['away_team']}  (İY {r['ht']})"
            )

    return "\n".join(lines)
