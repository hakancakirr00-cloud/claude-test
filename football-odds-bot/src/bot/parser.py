from __future__ import annotations

import re

URL_RE = re.compile(r"https?://\S+")
ID_RE = re.compile(r"\b\d{5,9}\b")


def extract_target(text: str) -> str | None:
    """Pull a Mackolik URL or numeric match ID from the user's message."""
    if not text:
        return None
    m = URL_RE.search(text)
    if m:
        return m.group(0)
    m = ID_RE.search(text)
    if m:
        return m.group(0)
    return None
