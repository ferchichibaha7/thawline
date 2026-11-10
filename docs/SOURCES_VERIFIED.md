# Sources verified

Spec section 0, rule 3: every source is fetched once before its ingester is written, a sample is kept in `docs/source-samples/`, and the real URL, columns and terms are recorded here. Where reality differed from the spec, reality won and the difference is noted.

Samples larger than about 50 kB are kept as the first 100 and last 100 lines, with a line recording the full size and a SHA-256 prefix (D-010). The full raw responses are archived by the pipeline under `data/raw/` on every run.

## Phase 1

### `indeed_jpi`: Indeed Hiring Lab Job Postings Index

Checked 2026-11-10.

- Repository: <https://github.com/hiring-lab/job_postings_tracker>, default branch `master`, last push 2026-11-04.
- License: CC BY 4.0 (GitHub license metadata and the `LICENSE` file). README: "freely available for public use, as long as *Indeed Hiring Lab* is cited as a source." Attribution string used: `Indeed Hiring Lab`.
- File list read from `https://api.github.com/repos/hiring-lab/job_postings_tracker/git/trees/master?recursive=1`. Files fetched from `https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/{CC}/{file}`.
- Country folders: AU, CA, DE, EA (euro area), ES, FR, GB, IE, IT, NL, US.
- Sector files exist for AU, CA, DE, FR, GB and US only. The README says: "we do not share sectoral data for Ireland." ES, IT, NL and EA have aggregate files only.
- Aggregate file `aggregate_job_postings_{CC}.csv`, columns: `date, jobcountry, indeed_job_postings_index_SA, indeed_job_postings_index_NSA, variable`. `variable` is `total postings` or `new postings`.
- Sector file `job_postings_by_sector_{CC}.csv`, columns: `date, jobcountry, indeed_job_postings_index, variable, display_name`. The README defines `indeed_job_postings_index` as seasonally adjusted. There is no NSA column in sector files.
- Values are levels with 1 Feb 2020 = 100, a seven-day trailing average, daily. Data on 2026-11-10 ran to 30 Oct 2026.
- **Differences from the spec:**
  - The spec expected a `variable` column and SA/NSA columns in both files; the sector file has SA only, which the spec allowed for.
  - Sector names in the data differ from `sector-job-title-examples.csv` in the same repository. The data has no "IT Operations & Helpdesk", "Information Design & Documentation" or "Mathematics"; it has "IT Infrastructure, Operations & Support", "IT Systems & Solutions", "Data & Analytics", "Mechanical Engineering" and "Social Science". France has no "Data & Analytics" or "Scientific Research & Development". See D-006 and D-021.
  - Real values fall outside the spec's 5 to 500 check: AU Logistic Support reached 520, GB Hospitality & Tourism fell to 4.9 in 2020. See D-008.
- Sample: `docs/source-samples/indeed/`.

### `bls`: US Bureau of Labor Statistics API

Checked 2026-11-10.

- Without a key: API v1, `POST https://api.bls.gov/publicAPI/v1/timeseries/data/` with `{"seriesid": [...], "startyear", "endyear"}`. Limits for unregistered use: 10 years per request, 25 series, 25 requests a day. With `BLS_API_KEY`, the pipeline switches to v2.
- Response: `status` (`REQUEST_SUCCEEDED`), `message` (list), `Results.series[].seriesID`, `data[]` with `year`, `period` (`M01` to `M12`, `M13` annual), `value`, `footnotes`.
- Series confirmed against the API and against the CES industry list `https://download.bls.gov/pub/time.series/ce/ce.industry`:
  - `CES6054150001`: industry `60541500`, "Computer systems design and related services", all employees, thousands, SA.
  - `CES5051320001`: industry `50513200`, "Software publishers" (NAICS 5132). The older code `CES5051120001` (NAICS 5112) no longer exists.
  - `JTS510000000000000JOL`: JOLTS, information sector, job openings, level, SA.
- License: public domain, US government work. Attribution string: `US Bureau of Labor Statistics`.
- `https://api.bls.gov/robots.txt` disallows all crawling. The API is documented for programmatic use, so the robots check is skipped for it (D-009).
- Sample: `docs/source-samples/bls/`.

### `fred`: FRED

Checked 2026-11-10.

- Without a key: `https://fred.stlouisfed.org/graph/fredgraph.csv?id={SERIES}`, columns `observation_date,{SERIES}`. Missing days (holidays) are blank. `fred.stlouisfed.org/robots.txt` allows `/graph/fredgraph.csv` with a crawl delay of 1 second.
- With `FRED_API_KEY`: `https://api.stlouisfed.org/fred/series/observations?series_id=...&api_key=...&file_type=json`. Not yet exercised.
- Terms, read from each series page:
  - `DGS10`: "public domain: citation requested". Source: Board of Governors of the Federal Reserve System (H.15).
  - `UNRATE`: "public domain: citation requested". Source: US Bureau of Labor Statistics.
  - `NASDAQCOM`: **"copyrighted: pre-approval required"**, "Copyright © 2016, NASDAQ OMX Group, Inc." The spec listed it as public. It is not ingested (D-007). The phase 4 `nasdaq_trend` indicator and the "Then and now" chart need another source.
- Sample: `docs/source-samples/fred/` (the NASDAQCOM sample was deleted).

## Later phases

Not yet verified: Indeed AI tracker, job boards (Greenhouse, Lever, Ashby), Hacker News via Algolia, Adzuna, remote boards, Anthropic Economic Index, SEC EDGAR, GDELT, RSS feeds, WARN notices, AI Layoffs cross-check, SEC XBRL, Census BTOS. Each gets an entry here before its ingester is written.
