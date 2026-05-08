from __future__ import annotations

import math


def wilson_lower(hits: int, n: int, z: float = 1.96) -> float:
    """Wilson score interval lower bound. Mirrors assets/js/confidence.js:wilsonLower."""
    if n <= 0:
        return 0.0
    p = hits / n
    z2 = z * z
    denom = 1.0 + z2 / n
    center = p + z2 / (2.0 * n)
    margin = z * math.sqrt((p * (1.0 - p) + z2 / (4.0 * n)) / n)
    return max(0.0, (center - margin) / denom)
