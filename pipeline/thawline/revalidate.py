"""Tell the web app which cache tags changed (spec 9.4). Skipped without a secret."""

from __future__ import annotations

import hashlib
import hmac
import json

import httpx

from .config import REVALIDATE_SECRET, SITE_URL

TAGS = ["indeed_jpi", "bls", "fred", "thaw_index", "forecasts", "signals", "datasets", "reference"]


def run(conn) -> int:
    if not REVALIDATE_SECRET:
        print("  REVALIDATE_SECRET not set; skipping revalidation")
        return 0
    body = json.dumps({"tags": TAGS}).encode()
    sig = hmac.new(REVALIDATE_SECRET.encode(), body, hashlib.sha256).hexdigest()
    try:
        r = httpx.post(f"{SITE_URL}/api/revalidate", content=body, timeout=30,
                       headers={"Content-Type": "application/json", "X-Thawline-Signature": sig})
        r.raise_for_status()
    except httpx.HTTPError as exc:
        print(f"  revalidation failed: {exc}")
        raise
    return len(TAGS)
