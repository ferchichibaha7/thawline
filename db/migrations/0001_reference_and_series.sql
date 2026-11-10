-- Phase 0 and 1: reference data, bookkeeping, time series and derived metrics.
-- Plain PostgreSQL, so it runs on the local database and on Supabase alike.
-- Spec section 9.1. Later phases add their tables in later migrations.

-- reference and bookkeeping (public read)
create table datasets (
  id text primary key, name text not null, source_url text not null,
  license text not null, attribution text not null, cadence_hours int not null,
  last_attempt_at timestamptz, last_success_at timestamptz, last_status text,
  data_through date, row_count bigint, notes text);

create table pipeline_runs (
  id bigserial primary key, job text not null, started_at timestamptz not null,
  finished_at timestamptz, status text not null, rows_written bigint, error text);

create table countries (
  code text primary key, label text not null, indeed_folder text, adzuna_code text, sort int);

create table role_families (
  id text primary key, label text not null, grp text not null,
  indeed_sector text, uses_competition boolean not null default false, sort int);

-- time series (public read)
create table series (
  id text primary key, dataset_id text not null references datasets(id),
  label text not null, unit text not null, country text, sector text,
  frequency text not null, seasonal_adj boolean, note text);

create table observations (
  series_id text not null references series(id), date date not null,
  value double precision not null, ingested_at timestamptz not null default now(),
  primary key (series_id, date));

-- Weekly means ending Friday (spec 8.3 step 1). isodow: Monday 1 ... Sunday 7.
create view series_weekly as
select series_id,
       (date + ((5 - extract(isodow from date)::int + 7) % 7))::date as week,
       avg(value) as value,
       count(*) as days
from observations
group by series_id, (date + ((5 - extract(isodow from date)::int + 7) % 7))::date;

-- derived metrics (public read)
create table thaw_index (
  week date, family_id text, country text, score double precision, state text,
  level double precision, momentum double precision, breadth double precision,
  entry_access double precision, competition double precision,
  weights jsonb not null, version text not null,
  primary key (week, family_id, country, version));

create table forecasts (
  id bigserial primary key, series_id text references series(id), made_on date not null,
  model text not null, mase_13 double precision, mase_26 double precision,
  mase_52 double precision, shipped boolean not null, paths jsonb, recovery jsonb,
  version text not null, unique (series_id, made_on, version));

-- signals (public read)
create table signals (
  id bigserial primary key, kind text not null, subject_type text, subject_id text,
  country text, signal_date date not null, sentence text not null,
  data jsonb, importance int not null default 1);
create unique index signals_identity on signals (kind, subject_type, subject_id, country, signal_date);
create index signals_by_date on signals (signal_date desc);

-- Row-level security: everything in this migration is public read; only the
-- pipeline (table owner or service role) writes.
do $$
declare t text;
begin
  foreach t in array array['datasets','pipeline_runs','countries','role_families','series',
                           'observations','thaw_index','forecasts','signals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;
