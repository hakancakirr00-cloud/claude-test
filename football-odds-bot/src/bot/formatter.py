from __future__ import annotations

import re

_ESCAPE_RE = re.compile(r"([_*`\[\]()])")


def escape_markdown(text: str) -> str:
    """Telegram MarkdownV1 için güvenli kaçış. Yalnızca metin içine gömerken kullan."""
    if not text:
        return ""
    return _ESCAPE_RE.sub(r"\\\1", text)
