#!/usr/bin/env node
// Local stand-in for the Supabase database, used until the owner creates the
// Supabase project (spec section 14). It runs a real PostgreSQL server from the
// `embedded-postgres` npm binaries, so the same migrations and SQL run here and
// on Supabase. Usage: node scripts/localdb.mjs start|stop|status|url
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data', 'pg');
const logFile = path.join(root, 'data', 'pg.log');
const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const platform = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
const bin = path.join(root, 'node_modules', '@embedded-postgres', platform, 'native', 'bin');

const OWNER_URL = `postgres://postgres@127.0.0.1:${port}/thawline`;
const READONLY_URL = `postgres://thawline_readonly:readonly@127.0.0.1:${port}/thawline`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(path.join(bin, cmd), args, { encoding: 'utf8', ...opts });
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

function isRunning() {
  if (!existsSync(dataDir)) return false;
  return run('pg_ctl', ['-D', dataDir, 'status']).code === 0;
}

async function ensureDatabase() {
  const { default: pg } = await import('pg');
  const admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = 'thawline'");
  if (exists.rowCount === 0) await admin.query('create database thawline');
  await admin.end();

  // The web app reads through a read-only role (spec 5.1). On Supabase the owner
  // creates the same role with a real password; see README.
  const db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'thawline' });
  await db.connect();
  await db.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'thawline_readonly') then
        create role thawline_readonly login password 'readonly';
      end if;
    end $$;
    grant connect on database thawline to thawline_readonly;
    grant usage on schema public to thawline_readonly;
    grant select on all tables in schema public to thawline_readonly;
    alter default privileges for role postgres in schema public grant select on tables to thawline_readonly;
  `);
  await db.end();
}

async function start() {
  // npm may skip the package's postinstall script, which restores the shared
  // library symlinks PostgreSQL needs. Running it again is harmless.
  const hydrate = path.join(bin, '..', '..', 'scripts', 'hydrate-symlinks.js');
  if (existsSync(hydrate)) spawnSync(process.execPath, [hydrate]);
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    mkdirSync(dataDir, { recursive: true });
    const init = run('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C']);
    if (init.code !== 0) throw new Error(init.out);
    // Listen on localhost only; no unix socket so no system directory is needed.
    writeFileSync(
      path.join(dataDir, 'postgresql.auto.conf'),
      `listen_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = ''\n`,
    );
  }
  if (!isRunning()) {
    const r = run('pg_ctl', ['-D', dataDir, '-l', logFile, '-w', 'start']);
    if (r.code !== 0) throw new Error(`${r.out}\nSee ${logFile}`);
  }
  await ensureDatabase();
  console.log(`Local database running on port ${port}.`);
  console.log(`DATABASE_URL=${OWNER_URL}`);
  console.log(`DATABASE_URL_READONLY=${READONLY_URL}`);
}

function stop() {
  if (!isRunning()) return console.log('Local database is not running.');
  const r = run('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
  console.log(r.code === 0 ? 'Local database stopped.' : r.out);
}

const cmd = process.argv[2];
if (cmd === 'start') await start();
else if (cmd === 'stop') stop();
else if (cmd === 'status') console.log(isRunning() ? `running on port ${port}` : 'stopped');
else if (cmd === 'url') console.log(`DATABASE_URL=${OWNER_URL}\nDATABASE_URL_READONLY=${READONLY_URL}`);
else {
  console.error('Usage: node scripts/localdb.mjs start|stop|status|url');
  process.exit(1);
}
