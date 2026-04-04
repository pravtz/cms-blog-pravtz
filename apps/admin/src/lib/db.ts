import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'nexus.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const migrations: Record<string, string> = {
    '001_initial': `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL DEFAULT 'pending_email',
        email_token TEXT,
        email_token_expires TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        email TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
    `,
  }

  const applied = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[]
  const appliedNames = new Set(applied.map((r) => r.name))

  for (const [name, sql] of Object.entries(migrations)) {
    if (!appliedNames.has(name)) {
      database.exec(sql)
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(name)
    }
  }
}

export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value)
}

export function ownerExists(): boolean {
  const db = getDb()
  const row = db
    .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
    .get()
  return !!row
}
