"""Give the website's read-only database user a new random password.

    pipeline/.venv/bin/python scripts/rotate_readonly_password.py

Updates DATABASE_URL_READONLY in .env. Nothing secret is printed. Afterwards,
paste the new value into Vercel (Project Settings > Environment Variables)
and redeploy.
"""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
sys.path.insert(0, str(ROOT / "scripts"))

import psycopg  # noqa: E402
from psycopg import sql  # noqa: E402
from setup_supabase import READONLY_ROLE, pooler_url, write_env  # noqa: E402

from thawline import config  # noqa: E402,F401  (loads .env)


def main() -> int:
    password = secrets.token_urlsafe(24)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        conn.execute(sql.SQL("alter role {} password {}").format(
            sql.Identifier(READONLY_ROLE), sql.Literal(password)))
        conn.commit()
    write_env({"DATABASE_URL_READONLY": pooler_url(READONLY_ROLE, password, 6543)})
    print("New read-only password set and saved to .env (DATABASE_URL_READONLY).")
    print("Now paste that value into Vercel and redeploy; the old value stops working immediately.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
