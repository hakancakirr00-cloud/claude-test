from __future__ import annotations

import logging
from dataclasses import dataclass

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from ..analysis.markets import compute_hit_rates
from ..analysis.matcher import applicable_keys, find_similar
from ..analysis.report import build_report
from ..config import AppConfig
from ..db import repository
from ..scraping.base import OddsProvider, ProviderError
from .parser import extract_target

log = logging.getLogger(__name__)

WELCOME = (
    "👋 *Futbol Oran Analiz Botu*\n\n"
    "Bana bir maç linki ya da Mackolik maç ID'si gönder;\n"
    "anlık oranlarını çekip geçmiş arşivde benzerlerini bulayım,\n"
    "İY 0.5 / MS 1.5 / MS 2.5 / KG Var için yüzdesel tahmin döndüreyim.\n\n"
    "Komutlar: /start, /help, /stats"
)


@dataclass
class BotDeps:
    cfg: AppConfig
    provider: OddsProvider


async def cmd_start(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(WELCOME, parse_mode=ParseMode.MARKDOWN)


async def cmd_help(update: Update, _: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(WELCOME, parse_mode=ParseMode.MARKDOWN)


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    deps: BotDeps = context.application.bot_data["deps"]
    n = repository.count_matches(deps.cfg.db_path)
    await update.message.reply_text(f"📚 Arşivde {n} maç var.")


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    deps: BotDeps = context.application.bot_data["deps"]
    text = (update.message.text or "").strip()
    target_str = extract_target(text)
    if not target_str:
        await update.message.reply_text(
            "❓ Geçerli bir maç linki veya ID bulamadım.\n"
            "Örnek: https://arsiv.mackolik.com/Match/Default.aspx?id=123456"
        )
        return

    progress = await update.message.reply_text("⏳ Oranlar çekiliyor…")

    try:
        fetched = await deps.provider.fetch(target_str)
    except ProviderError as e:
        log.warning("Provider error: %s", e)
        await progress.edit_text(f"❌ Maç oranları çekilemedi: {e}")
        return
    except Exception as e:
        log.exception("Unexpected provider error")
        await progress.edit_text(f"❌ Beklenmedik hata: {e}")
        return

    target = fetched.as_target()
    keys = list(deps.cfg.matching.match_keys) or applicable_keys(target)

    archive = repository.load_archive(
        deps.cfg.db_path,
        target={k: target.get(k) for k in keys},
        tolerance=deps.cfg.matching.tolerance,
    )
    similar = find_similar(
        archive,
        target,
        tolerance=deps.cfg.matching.tolerance,
        match_keys=keys,
        max_results=deps.cfg.matching.max_results,
    )
    hits = compute_hit_rates(similar)
    used = [k for k in keys if target.get(k) is not None and k in archive.columns]

    report = build_report(
        target=target,
        matches_df=similar,
        hit_rates=hits,
        used_keys=used,
        tolerance=deps.cfg.matching.tolerance,
        min_sample=deps.cfg.matching.min_sample,
    )
    await progress.edit_text(report, parse_mode=ParseMode.MARKDOWN)
