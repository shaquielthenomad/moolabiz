import Database from "better-sqlite3";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || "/data/store.db";

let _db: InstanceType<typeof Database> | null = null;

function getDb(): InstanceType<typeof Database> {
  if (_db) return _db;

  // Ensure directory exists
  const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      image_url TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      in_stock INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_provider TEXT DEFAULT '',
      payment_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return _db;
}

// Proxy that lazily initializes the database on first use
const db = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
});

export default db;
