# Decisions

Spec section 0, rule 9: decisions the builder made, newest last. Each says what was decided and why.

## D-001 Work without accounts using local stand-ins (2026-11-10)

The owner asked to start before creating any accounts (spec section 14). Each account has a local stand-in that keeps the same interface, so switching is a change of environment variables:

| Account | Local stand-in |
|---|---|
| Supabase Postgres | Real PostgreSQL 18 from the `embedded-postgres` npm package, started by `npm run db:start`. Same migrations and SQL. |
| Supabase Storage | `data/raw/` for raw archives and `data/exports/` for CSV and JSON snapshots, served by `/exports/[file]`. |
| Supabase read-only role | Local role `thawline_readonly`, created by `scripts/localdb.mjs`. |
| Vercel | `npm run dev` or `npm run build && npm start` in `web/`. |
| GitHub Actions | `python -m thawline.run weekly` and `monthly` run by hand. Workflow files are written and ready. |
| FRED key | FRED's public CSV download. The ingester uses the API when `FRED_API_KEY` is set. |
| BLS key | BLS API v1, which needs no registration. v2 is used when `BLS_API_KEY` is set. |
| Contact email | The bot's User-Agent omits it until `CONTACT_EMAIL` is set. |
| Anthropic key | Not needed until phase 2. |

## D-002 Python 3.14 locally, 3.12 or newer supported

The machine has Python 3.14. `pyproject.toml` requires 3.12 or newer and CI tests 3.12, as the spec asks.

## D-003 Library versions

Rule 7 asks for the latest stable release of each library. Three exceptions, because the network at build time was slow (about 100 kB/s) and these were already in the npm cache:

- Next.js 16.3.4 instead of 16.4.6, and Tailwind CSS 4.2.1 instead of 4.3.5. No API newer than 16.3 is used. Upgrade with `npm install next@latest tailwindcss@latest @tailwindcss/postcss@latest`.
- TypeScript 5.9.3 instead of 7.0. TypeScript 7 is the native compiler and Next.js type-checking against it was not verified.
- `postgres` (postgres.js) 3.4 instead of 4.x. The 4.x API was not verified.

## D-004 Drizzle deferred

Phase 1 only reads, with about a dozen queries. They are written as parameterised SQL with postgres.js in `web/lib/queries.ts`. Drizzle can come in with the write paths of phase 2 (submissions, admin).

## D-005 Caching with `unstable_cache`

Next.js 16 recommends the `use cache` directive with Cache Components. Turning Cache Components on changes route rules across the app, so phase 1 uses `unstable_cache` with tags, which still works, and `revalidateTag(tag, 'max')`. Migrate in a later phase.

## D-006 Role family to Indeed sector mapping

The spec's proposals were checked against the sector names in the Indeed files (not the older examples file):

| Family | Spec proposal | Used | Why |
|---|---|---|---|
| `data_sci` | Mathematics | Data & Analytics | Mathematics no longer exists. Its examples (analyst, data scientist) and Information Design's (business analyst, data analyst) match the new Data & Analytics sector. |
| `it_ops` | IT Operations & Helpdesk | IT Infrastructure, Operations & Support | Renamed in the data. |
| `product_design`, `ux_research` | Information Design & Documentation | Arts & Entertainment | Indeed's examples put "designer" in Arts & Entertainment; Information Design's examples were business and data analysts. The sector no longer exists anyway. |
| `brand_graphic` | Arts & Entertainment or Marketing | Arts & Entertainment | Examples: designer, artist. |
| `content_design` | Information Design & Documentation | Media & Communications | Examples include writer. |
| `tech_writing` | Information Design & Documentation | Media & Communications | The proposed sector no longer exists; writers are in Media & Communications. |

All others follow the spec. Every outlook page names the sector it uses. Roles that share a sector share a score in `ti-1`, and the page says so.

## D-007 NASDAQCOM not used

FRED marks NASDAQCOM "copyrighted: pre-approval required". Publishing values derived from it would need Nasdaq's permission. The phase 4 indicator `nasdaq_trend` and the "Then and now" chart need a source that allows republication, or permission from Nasdaq. Owner decision before phase 4.

## D-008 Indeed value check widened to 1 to 1000

Spec 11.1 says index values must be between 5 and 500. Real, long-published values break both bounds: AU Logistic Support peaked at 520 in 2021 and GB Hospitality & Tourism fell to 4.9 in 2020. The check exists to catch parsing errors, so it is 1 to 1000 for Indeed. The week-on-week check (under 25%) applies to the latest 8 weeks only, so pandemic history does not block new data.

## D-009 robots.txt and documented APIs

`api.bls.gov/robots.txt` disallows everything. robots.txt addresses crawlers; the BLS API is documented for programmatic use with published rate limits. The shared HTTP client skips the robots check for documented API hosts (`api.bls.gov`, `api.stlouisfed.org`, `api.github.com`) and honours it everywhere else.

## D-010 Source samples trimmed

The US Indeed sector file is 12 MB. Samples over about 50 kB keep the first and last 100 lines plus a line with the full size and hash. Full raw responses are archived in `data/raw/`, which is not committed.

## D-011 State-change signals per sector

In `ti-1`, every family mapped to a sector has the same score, so a state change would produce up to 12 identical signals at once. One signal is emitted per sector and country ("Roles mapped to Software Development in the United States moved from Cold to Thawing."), listing the families in its data. Switch to per-family signals when phase 3 makes scores differ.

## D-012 Navigation shows built sections only

The wireframe's navigation includes Aftermath, Pressure and Demand. Linking to pages that do not exist yet would mislead, so they join the navigation when their phase ships. The home page shows the Aftermath and pressure panels with an `EmptyState` that says what is missing.

## D-013 Position from the latest week, direction from the four-week average

The spec does not say which reading the position clause uses. Charts and their readouts show weekly values, so statements and the line strip place a sector by its latest weekly reading; otherwise the headline said "21% below" while the chart said "19% below". Direction (streaks and 13-week change), the Level component, and signals use the four-week average, as the spec says. The method page explains this.

## D-014 Story files

All stories live in one Component Story Format file, `web/components/stories.tsx`, rendered by the gallery at `/dev/components`. Storybook is not installed; it can load the same file. Market components use fixtures recorded from the real database by `pipeline/scripts/record_web_fixtures.py`. Aftermath and demand components have no data yet, so their stories show layout only, with neutral text and no company names, and are labelled as such. The gallery returns 404 in production unless `THAWLINE_GALLERY=1`.

## D-015 Content Security Policy deferred

A nonce-based CSP forces every page to render dynamically, which conflicts with incremental static regeneration under `unstable_cache`. Phase 1 sends `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`. Add the CSP together with the Cache Components migration (D-005).

## D-016 CSV downloads carry their license in the first line

API CSV responses start with a line such as `# Source: Indeed Hiring Lab. License: CC BY 4.0. Data through: 2026-10-30.` so the license travels with the file (spec 15). Most tools skip it with a comment option, for example `pandas.read_csv(url, comment="#")`. The `/data` page says so.

## D-017 Sanity check (spec 8.1) passes

Run on 2026-11-10 against the United States Software Development series. January to March 2022 averaged 99.6, Open. The lowest reading was 5.9, Frozen, in the week to 19 June 2020; the lowest since 2022 was 7.6, Frozen, in the week to 28 March 2025. No threshold was changed. The method page recomputes this live.

## D-018 First forecast run

30 of 75 series beat the naive model by enough to publish (MASE at 26 weeks below 0.95). In the United States, Software Development, Data & Analytics and all jobs did not, so their pages say the trend is not predictable enough and give the recent direction. This is the ship rule working as intended.

## D-019 Single-threaded maths in forecast workers

The backtest runs one process per core. Without limiting BLAS threads, each process started one thread per core and the run took ten minutes on a busy machine. `thawline/__init__.py` sets `OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS` and `MKL_NUM_THREADS` to 1; the run takes about 40 seconds.

## D-020 Theme control is text

The wireframe shows a [◐] glyph. Section 3.8 rules out icons as decoration and section 3.5 asks button text to say what happens, so the control reads "Dark theme" or "Light theme".

## D-021 Line-strip sectors

The spec's list includes two sectors that no longer exist. "IT Operations & Helpdesk" is shown as its renamed successor, IT Infrastructure, Operations & Support. "Information Design & Documentation" is replaced by Data & Analytics, its closest successor (D-006).

## D-022 Tests not yet in place

Playwright flows, visual regression, axe checks and Lighthouse budgets (spec 11.1) need browser downloads that were impractical on the build-time network. Unit tests exist for the pipeline (40) and for statements and freshness (17). Screens were reviewed with headless Chrome at 390 px and 1280 px in both themes. Add Playwright before phase 1 is accepted.

## D-023 No paid LLM API

The owner does not want to pay for the Anthropic API. Spec 7.6 uses an LLM for three helper tasks; each gets a free path, and `ANTHROPIC_API_KEY` becomes optional:

| Task (spec 7.6) | Without an API key |
|---|---|
| Title classification fallback (phase 3) | Regular expressions only. Unmatched titles get no family and are counted in coverage. A moderator can label frequent unmatched titles in `title_cache`. |
| Evidence extraction (phase 2) | Discovery still runs (EDGAR, GDELT, RSS). Candidates enter the review queue with their link and headline, and a moderator fills in the fields with a short form. The same validators run on what the moderator enters. |
| Duplicate grouping (phase 2) | Rules: same company, same evidence type, within 30 days, plus matching URL or headline. The moderator decides borderline cases. |

The cost is moderator time, mostly for the 25-company launch set. If an API key is added later, the pipeline uses it without other changes.

Update: extraction will have a pluggable backend, `EXTRACT_BACKEND=manual|ollama|anthropic`, default `manual`. With `ollama`, a small local model on the owner's laptop (RTX 3050, 6 GB) drafts the fields and the same validators and moderator approval apply, so a wrong draft is rejected or corrected rather than published. It runs on the laptop, not in GitHub Actions, which has no GPU. Before it is used, it must match hand-entered fields on a labelled set of real articles.
