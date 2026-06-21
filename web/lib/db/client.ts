import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";

import type { DB } from "@/lib/db/schema";

// node-pg parses the `date` type (oid 1082) into a JS Date at local midnight, which
// shifts the calendar day across timezones. We treat calendar days as opaque strings
// throughout the curated schema, so keep them as the raw 'YYYY-MM-DD' text.
types.setTypeParser(1082, (v) => v);

// Lazily create one Kysely instance, reused across hot-reloads in dev. Lazy so that
// importing this module never connects (e.g. during `next build` page-data collection
// when DATABASE_URL_NODE may be absent) — only an actual query opens a connection.
const globalForDb = globalThis as unknown as { _kysely?: Kysely<DB> };

export function getDb(): Kysely<DB> {
  if (globalForDb._kysely) return globalForDb._kysely;

  const connectionString = process.env.DATABASE_URL_NODE;
  if (!connectionString) {
    throw new Error("DATABASE_URL_NODE is not set — cannot connect to Postgres.");
  }
  const instance = new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString, max: 5 }) }),
  });
  globalForDb._kysely = instance;
  return instance;
}
