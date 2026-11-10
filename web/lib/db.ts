import 'server-only';
import postgres from 'postgres';

/**
 * Read-only database client (spec 5.1). Locally this points at the database
 * started by `npm run db:start`; in production at Supabase's read-only role.
 */
const url =
  process.env.DATABASE_URL_READONLY ?? 'postgres://thawline_readonly:readonly@127.0.0.1:54329/thawline';

const asText = { serialize: (x: unknown) => String(x), parse: (x: string) => x };

const globalForSql = globalThis as unknown as { __thawlineSql?: postgres.Sql };

export const sql: postgres.Sql =
  globalForSql.__thawlineSql ??
  postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    // Calendar dates and timestamps stay strings so cached results serialise cleanly.
    types: {
      date: { to: 1082, from: [1082], ...asText },
      timestamptz: { to: 1184, from: [1184], ...asText },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForSql.__thawlineSql = sql;
