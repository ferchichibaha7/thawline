"""Environment, paths, cadences and the shared metrics config (spec 5.3, 6.5)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import yaml

PIPELINE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = PIPELINE_DIR.parent
DATA_DIR = Path(os.environ.get("THAWLINE_DATA_DIR", REPO_DIR / "data"))
# Local stand-in for Supabase Storage until the owner provides a project (spec 14).
RAW_DIR = DATA_DIR / "raw"
EXPORT_DIR = DATA_DIR / "exports"
METRICS_PATH = REPO_DIR / "config" / "metrics.json"
TAXONOMY_DIR = Path(__file__).resolve().parent / "taxonomy"
SOURCES_DIR = Path(__file__).resolve().parent / "sources"

DEFAULT_LOCAL_DB = "postgres://postgres@127.0.0.1:54329/thawline"


def _load_dotenv() -> None:
    """Read KEY=VALUE lines from the repo's .env without overriding real env vars."""
    path = REPO_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


DATABASE_URL = env("DATABASE_URL", DEFAULT_LOCAL_DB)
SITE_URL = env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
CONTACT_EMAIL = env("CONTACT_EMAIL")
REVALIDATE_SECRET = env("REVALIDATE_SECRET")
FRED_API_KEY = env("FRED_API_KEY")
BLS_API_KEY = env("BLS_API_KEY")


def user_agent() -> str:
    contact = f"; {CONTACT_EMAIL}" if CONTACT_EMAIL else ""
    return f"ThawlineBot/1.0 (+{SITE_URL}/about{contact})"


@lru_cache(maxsize=1)
def metrics() -> dict:
    return json.loads(METRICS_PATH.read_text())


@lru_cache(maxsize=1)
def families() -> list[dict]:
    return yaml.safe_load((TAXONOMY_DIR / "families.yaml").read_text())["families"]


# Countries shown in the interface, in this order, when Indeed publishes them (spec 7.2).
UI_COUNTRIES = ["US", "GB", "FR", "DE", "CA", "AU", "IE", "NL", "ES", "IT"]
COUNTRY_LABELS = {
    "US": "United States", "GB": "United Kingdom", "FR": "France", "DE": "Germany",
    "CA": "Canada", "AU": "Australia", "IE": "Ireland", "NL": "Netherlands", "ES": "Spain",
    "IT": "Italy", "EA": "Euro area", "REMOTE": "Remote, worldwide",
}
_WITH_THE = {"US", "GB", "NL", "EA"}


def country_in_sentence(code: str) -> str:
    """"the United States" in running text, "France" otherwise."""
    label = COUNTRY_LABELS.get(code, code)
    return f"the {label}" if code in _WITH_THE else label
