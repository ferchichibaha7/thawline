"""Apply db/migrations/*.sql in order, once each."""

from __future__ import annotations

from .config import REPO_DIR

MIGRATIONS = REPO_DIR / "db" / "migrations"


def run(conn) -> int:
    conn.execute("""create table if not exists schema_migrations (
        version text primary key, applied_at timestamptz not null default now())""")
    done = {r[0] for r in conn.execute("select version from schema_migrations").fetchall()}
    applied = 0
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.stem in done:
            continue
        conn.execute(path.read_text())
        conn.execute("insert into schema_migrations (version) values (%s)", (path.stem,))
        applied += 1
        print(f"  applied {path.name}")
    return applied
