# Thawline

See where the freeze is lifting.

Thawline shows tech and design workers where the job market stands for their role, what happened at companies that cut staff for AI, and how much pressure the AI boom is under, using only sourced public data. Every number carries its source and date, forecasts appear only when they beat a simple baseline, and the method is published in full.

The build follows a written specification kept outside this repository; references such as "spec 8.1" point to its sections. Decisions made along the way are in [docs/DECISIONS.md](docs/DECISIONS.md), and every data source was checked and recorded in [docs/SOURCES_VERIFIED.md](docs/SOURCES_VERIFIED.md).

## Status

Live at **https://thawline.vercel.app** (Vercel, Supabase, GitHub Actions; all free tiers).

Phase 0 (foundations) and most of phase 1 (the market) are built and run locally, with no accounts:

- Pipeline: Indeed Hiring Lab, BLS and FRED ingestion; Thaw Index `ti-1` (Level and Momentum); backtested forecasts `fc-1` with the ship rule; signals; CSV and JSON exports.
- Web: home with the line strip, outlook by role, sector pages, signals and RSS, method, data, about, privacy, status, the public API, share images, and the component gallery at `/dev/components`.

Still to do for phase 1: Playwright, axe and Lighthouse checks (D-022), deployment, and the accounts in spec section 14.

## Run it locally

You need Node.js 24 and Python 3.12 or newer, plus [uv](https://docs.astral.sh/uv/) (or plain `pip`).

```sh
# 1. Install
npm install                       # local PostgreSQL binaries for development
(cd web && npm install)
(cd pipeline && uv sync)          # or: python -m venv .venv && .venv/bin/pip install -e . pytest

# 2. Start the local database (a real PostgreSQL on port 54329, data in data/pg)
npm run db:start

# 3. Fetch the data and compute everything (about two minutes)
cd pipeline
.venv/bin/python -m thawline.run phase1
cd ..

# 4. Start the site
cd web && npm run dev             # http://localhost:3000
```

Later refreshes: `python -m thawline.run weekly` (Indeed, FRED, index, forecasts, signals, exports) and `python -m thawline.run monthly` (BLS). Single jobs run the same way, for example `python -m thawline.run forecast`. Stop the database with `npm run db:stop`.

No `.env` is needed locally. [.env.example](.env.example) lists every variable for when the accounts exist.

## Layout

```
config/metrics.json   weights, thresholds and versions, read by the pipeline and the /method page
db/migrations/        SQL migrations (plain PostgreSQL, Supabase-compatible)
pipeline/             Python: sources, derived metrics, forecasts, exports  (python -m thawline.run <job>)
web/                  Next.js site and API
docs/                 source verification, decisions, raw source samples
scripts/localdb.mjs   local PostgreSQL for development
```

## Tests

```sh
cd pipeline && .venv/bin/python -m pytest && .venv/bin/ruff check .
cd web && npm run typecheck && npm test
```

## Moving to the real accounts

1. Create the Supabase project. Run `db/migrations/*.sql` (or `DATABASE_URL=... python -m thawline.run migrate`), then create the read-only role:
   ```sql
   create role thawline_readonly login password '<choose one>';
   grant usage on schema public to thawline_readonly;
   grant select on all tables in schema public to thawline_readonly;
   alter default privileges in schema public grant select on tables to thawline_readonly;
   ```
2. Set `DATABASE_URL` in GitHub Actions secrets and `DATABASE_URL_READONLY` in Vercel. The workflows in `.github/workflows/` then run the pipeline on schedule.
3. Set `REVALIDATE_SECRET` in both, `NEXT_PUBLIC_SITE_URL` to the domain, and `CONTACT_EMAIL`.
4. Optional for phase 1: `FRED_API_KEY` and `BLS_API_KEY` raise rate limits.

## Licenses

Code: MIT ([LICENSE](LICENSE)). Data produced by Thawline: CC BY 4.0 ([DATA_LICENSE](DATA_LICENSE)). Job postings data: Indeed Hiring Lab, CC BY 4.0. See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
