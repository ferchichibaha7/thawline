"""One-time setup of the Supabase project, run by the owner in their own terminal.

    pipeline/.venv/bin/python scripts/setup_supabase.py

It asks for the database password and the Supabase secret key with hidden
input, so no secret is typed into a chat or shown on screen. Then it:

1. writes DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
   CONTACT_EMAIL to the repository's .env (git-ignored),
2. applies the migrations and seeds reference data,
3. creates the read-only role the website uses, with a random password, and
   writes DATABASE_URL_READONLY to .env,
4. stores the pipeline's secrets and variables in GitHub Actions,
5. starts the weekly and monthly workflows, which load all data from GitHub's
   servers.
"""

from __future__ import annotations

import getpass
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
REPO = "ferchichibaha7/thawline"
PROJECT_REF = "dguewkxnbbcqeaegbosb"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com"
READONLY_ROLE = "thawline_readonly"


def pooler_url(role: str, password: str, port: int) -> str:
    return f"postgresql://{role}.{PROJECT_REF}:{quote(password, safe='')}@{POOLER_HOST}:{port}/postgres"


def write_env(values: dict[str, str]) -> None:
    lines = ENV_PATH.read_text().splitlines() if ENV_PATH.exists() else []
    kept = [line for line in lines if line.split("=", 1)[0].strip() not in values]
    kept += [f"{k}={v}" for k, v in values.items()]
    ENV_PATH.write_text("\n".join(kept) + "\n")
    ENV_PATH.chmod(0o600)


def gh(*args: str, stdin: str | None = None) -> None:
    subprocess.run(["gh", *args, "--repo", REPO], input=stdin, text=True, check=True,
                   stdout=subprocess.DEVNULL)


def main() -> int:
    print("Thawline: Supabase setup\n")
    print("Find these in the Supabase dashboard for the thawline project:")
    print("  Database password: Project Settings > Database > Reset database password")
    print("  Secret key:        Project Settings > API Keys > secret key (or service_role)\n")
    db_password = getpass.getpass("Database password (hidden): ").strip()
    secret_key = getpass.getpass("Supabase secret key (hidden): ").strip()
    contact = input("Contact email for the site and the bot: ").strip()
    if not (db_password and secret_key and "@" in contact):
        print("All three values are needed.")
        return 1

    database_url = pooler_url("postgres", db_password, 5432)
    write_env({
        "DATABASE_URL": database_url,
        "NEXT_PUBLIC_SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": secret_key,
        "CONTACT_EMAIL": contact,
    })
    os.environ.update({"DATABASE_URL": database_url, "NEXT_PUBLIC_SUPABASE_URL": SUPABASE_URL,
                       "SUPABASE_SERVICE_ROLE_KEY": secret_key, "CONTACT_EMAIL": contact})

    sys.path.insert(0, str(ROOT / "pipeline"))
    import psycopg
    from psycopg import sql
    from thawline import migrate, seed

    print("\nConnecting to Supabase ...")
    with psycopg.connect(database_url) as conn:
        print(f"Migrations applied: {migrate.run(conn)}")
        print(f"Role families seeded: {seed.run(conn)}")
        readonly_password = secrets.token_urlsafe(24)
        exists = conn.execute("select 1 from pg_roles where rolname = %s", (READONLY_ROLE,)).fetchone()
        verb = "alter" if exists else "create"
        conn.execute(sql.SQL(verb + " role {} login password {}").format(
            sql.Identifier(READONLY_ROLE), sql.Literal(readonly_password)))
        conn.execute(f"grant usage on schema public to {READONLY_ROLE}")
        conn.execute(f"grant select on all tables in schema public to {READONLY_ROLE}")
        conn.execute(f"alter default privileges for role postgres in schema public "
                     f"grant select on tables to {READONLY_ROLE}")
        conn.commit()
    readonly_url = pooler_url(READONLY_ROLE, readonly_password, 6543)
    write_env({"DATABASE_URL_READONLY": readonly_url})
    print("Read-only role ready; DATABASE_URL_READONLY written to .env")

    print("\nStoring GitHub Actions secrets and variables ...")
    gh("secret", "set", "DATABASE_URL", stdin=database_url)
    gh("secret", "set", "SUPABASE_SERVICE_ROLE_KEY", stdin=secret_key)
    gh("variable", "set", "NEXT_PUBLIC_SUPABASE_URL", "--body", SUPABASE_URL)
    gh("variable", "set", "CONTACT_EMAIL", "--body", contact)

    print("Starting the weekly and monthly workflows to load the data ...")
    gh("workflow", "run", "weekly.yml")
    gh("workflow", "run", "monthly.yml")

    print("\nDone. Next: in Vercel, set DATABASE_URL_READONLY to the value of that line in .env")
    print(f"({ENV_PATH}). Then tell Claude it is done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
