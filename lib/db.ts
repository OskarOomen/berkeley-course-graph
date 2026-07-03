import { createClient, type Client } from "@libsql/client";

const globalForDb = globalThis as unknown as { dbClient?: Client };

export const db: Client =
  globalForDb.dbClient ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") globalForDb.dbClient = db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS courses (
  code         TEXT PRIMARY KEY,
  display_code TEXT NOT NULL,
  title        TEXT NOT NULL,
  department   TEXT NOT NULL,
  units        INTEGER NOT NULL,
  description  TEXT NOT NULL,
  prereq_expr  TEXT
);
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department);

CREATE TABLE IF NOT EXISTS plans (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT 'My 4-Year Plan',
  data       TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.execute(statement);
  }
  initialized = true;
}
