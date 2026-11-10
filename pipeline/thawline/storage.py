"""Supabase Storage uploads for public exports (spec 9.3).

Used when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set;
otherwise exports stay in data/exports/ only. Files go to the public bucket
`exports`, readable at {SUPABASE_URL}/storage/v1/object/public/exports/{name}.
"""

from __future__ import annotations

from pathlib import Path

import httpx

from .config import env

BUCKET = "exports"
TYPES = {".csv": "text/csv; charset=utf-8", ".json": "application/json"}


def configured() -> bool:
    return bool(env("NEXT_PUBLIC_SUPABASE_URL") and env("SUPABASE_SERVICE_ROLE_KEY"))


def _client() -> httpx.Client:
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    return httpx.Client(
        base_url=f"{env('NEXT_PUBLIC_SUPABASE_URL').rstrip('/')}/storage/v1",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=120,
    )


def ensure_bucket(client: httpx.Client) -> None:
    r = client.get(f"/bucket/{BUCKET}")
    if r.status_code == 200:
        return
    r = client.post("/bucket", json={"id": BUCKET, "name": BUCKET, "public": True})
    if r.status_code not in (200, 201, 409):
        r.raise_for_status()


def upload(paths: list[Path]) -> int:
    with _client() as client:
        ensure_bucket(client)
        for path in paths:
            r = client.post(
                f"/object/{BUCKET}/{path.name}",
                content=path.read_bytes(),
                headers={"Content-Type": TYPES.get(path.suffix, "application/octet-stream"),
                         "x-upsert": "true", "Cache-Control": "max-age=3600"},
            )
            r.raise_for_status()
    return len(paths)
