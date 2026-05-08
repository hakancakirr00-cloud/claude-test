from __future__ import annotations

import logging
import sys

from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
)

from .bot.handlers import BotDeps, cmd_help, cmd_start, cmd_stats, on_message
from .config import load_config
from .db.seed import init_db
from .scraping.factory import get_provider


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def build_application() -> Application:
    cfg = load_config()
    _configure_logging(cfg.log_level)

    if not cfg.telegram_token:
        print(
            "TELEGRAM_TOKEN ortam değişkeni boş. .env dosyasına ekleyin.",
            file=sys.stderr,
        )
        sys.exit(2)

    init_db(cfg.db_path, cfg.seed_csv)

    provider = get_provider(cfg.scraping)
    deps = BotDeps(cfg=cfg, provider=provider)

    app = ApplicationBuilder().token(cfg.telegram_token).build()
    app.bot_data["deps"] = deps

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    return app


def main() -> None:
    app = build_application()
    app.run_polling(allowed_updates=None)


if __name__ == "__main__":
    main()
