"""CLI: python -m thawline.run <job> [<job> ...]

Jobs: migrate, seed, indeed, fred, bls, thaw_index, forecast, signals, export,
revalidate. Groups: weekly, monthly, phase1 (everything, in order).

A failed job does not stop later independent jobs; signals, export and
revalidate always run (spec 7.1).
"""

from __future__ import annotations

import sys
import time
import traceback

from . import db, export, migrate, revalidate, seed
from .derive import signals, thaw_index
from .models import forecast
from .sources import bls, fred, indeed

JOBS = {
    "migrate": migrate.run,
    "seed": seed.run,
    "indeed": indeed.run,
    "fred": fred.run,
    "bls": bls.run,
    "thaw_index": thaw_index.run,
    "forecast": forecast.run,
    "signals": signals.run,
    "export": export.run,
    "revalidate": revalidate.run,
}
SOURCE_DATASET = {"indeed": "indeed_jpi", "fred": "fred", "bls": "bls"}
GROUPS = {
    "weekly": ["indeed", "fred", "thaw_index", "forecast", "signals", "export", "revalidate"],
    "monthly": ["bls", "export", "revalidate"],
    "phase1": ["migrate", "seed", "indeed", "fred", "bls", "thaw_index", "forecast", "signals",
               "export", "revalidate"],
}
ALWAYS = {"signals", "export", "revalidate"}
DEPENDS = {"thaw_index": {"indeed", "seed"}, "forecast": {"indeed"}}


def run_job(name: str) -> bool:
    started = time.monotonic()
    print(f"{name}: starting")
    with db.connect() as conn:
        run_id = None
        if name != "migrate":
            run_id = db.start_run(conn, name)
        try:
            rows = JOBS[name](conn)
            conn.commit()
            if run_id:
                db.finish_run(conn, run_id, "ok", rows)
            print(f"{name}: ok, {rows} rows, {time.monotonic() - started:.1f}s")
            return True
        except Exception as exc:
            conn.rollback()
            err = "".join(traceback.format_exception_only(exc)).strip()
            if name in SOURCE_DATASET:
                db.mark_attempt(conn, SOURCE_DATASET[name], f"error: {err}")
                conn.commit()
            if run_id:
                db.finish_run(conn, run_id, "error", None, traceback.format_exc()[-4000:])
            print(f"{name}: FAILED: {err}", file=sys.stderr)
            return False


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    names: list[str] = []
    for a in argv:
        names += GROUPS.get(a, [a])
    unknown = [n for n in names if n not in JOBS]
    if unknown:
        print(f"Unknown job(s): {', '.join(unknown)}", file=sys.stderr)
        return 2
    failed: set[str] = set()
    for name in names:
        if DEPENDS.get(name, set()) & failed and name not in ALWAYS:
            print(f"{name}: skipped because {', '.join(DEPENDS[name] & failed)} failed")
            failed.add(name)
            continue
        if not run_job(name):
            failed.add(name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
