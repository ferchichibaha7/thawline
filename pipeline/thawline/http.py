"""Shared HTTP client (spec 6.5).

Identifies the bot, rate-limits per host, retries with exponential backoff,
honours robots.txt and Retry-After, and archives every raw response, gzipped,
before anything parses it.
"""

from __future__ import annotations

import gzip
import threading
import time
import urllib.robotparser
from datetime import UTC, datetime
from urllib.parse import urlsplit

import httpx
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from .config import RAW_DIR, user_agent

TIMEOUT = 30.0
# Minimum seconds between requests to the same host. SEC allows 10/s; job boards 1/s.
HOST_INTERVAL = {"api.bls.gov": 1.0, "fred.stlouisfed.org": 1.0, "api.stlouisfed.org": 0.5}
DEFAULT_INTERVAL = 1.0

# Documented APIs meant for programmatic use. Their robots.txt files address web
# crawlers (api.bls.gov disallows everything), so the robots check is skipped for
# them and their own published rate limits apply instead. See docs/DECISIONS.md D-009.
API_HOSTS = {"api.bls.gov", "api.stlouisfed.org", "api.github.com"}

_last_request: dict[str, float] = {}
_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
_lock = threading.Lock()
_client: httpx.Client | None = None


class RobotsDisallowed(Exception):
    pass


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            timeout=TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": user_agent()},
        )
    return _client


def _wait_for_host(host: str) -> None:
    interval = HOST_INTERVAL.get(host, DEFAULT_INTERVAL)
    with _lock:
        last = _last_request.get(host, 0.0)
        delay = last + interval - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        _last_request[host] = time.monotonic()


def _allowed(url: str) -> bool:
    parts = urlsplit(url)
    if parts.netloc in API_HOSTS:
        return True
    host = f"{parts.scheme}://{parts.netloc}"
    if host not in _robots:
        parser = urllib.robotparser.RobotFileParser()
        try:
            r = client().get(f"{host}/robots.txt")
            if r.status_code == 200:
                parser.parse(r.text.splitlines())
                _robots[host] = parser
            else:
                _robots[host] = None  # no robots.txt: allowed
        except httpx.HTTPError:
            _robots[host] = None
    parser = _robots[host]
    return True if parser is None else parser.can_fetch(user_agent(), url)


def _retryable(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(exc, httpx.TransportError)


@retry(
    retry=retry_if_exception(_retryable),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    reraise=True,
)
def _request(method: str, url: str, **kwargs) -> httpx.Response:
    host = urlsplit(url).netloc
    _wait_for_host(host)
    response = client().request(method, url, **kwargs)
    if response.status_code == 429 or response.status_code == 503:
        retry_after = response.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            time.sleep(min(int(retry_after), 120))
    response.raise_for_status()
    return response


def archive_path(source: str, name: str):
    now = datetime.now(UTC)
    return RAW_DIR / source / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}" / f"{name}.gz"


def archive(source: str, name: str, content: bytes) -> str:
    """Store a raw response at raw/{source}/{YYYY}/{MM}/{DD}/{name}.gz and return its path."""
    path = archive_path(source, name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb") as fh:
        fh.write(content)
    return str(path)


def fetch(source: str, name: str, url: str, method: str = "GET", reuse_today: bool = False,
          **kwargs) -> bytes:
    """Fetch a URL politely, archive the raw bytes, and return them.

    With reuse_today, a response already archived today is read back instead of
    downloaded again, so a rerun on the same day is cheap and gives the same rows.
    """
    if reuse_today:
        cached = archive_path(source, name)
        if cached.exists():
            with gzip.open(cached, "rb") as fh:
                return fh.read()
    if not _allowed(url):
        raise RobotsDisallowed(url)
    response = _request(method, url, **kwargs)
    archive(source, name, response.content)
    return response.content
