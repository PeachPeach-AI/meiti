import initSqlJs, { Database } from 'sql.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

let db: Database;
let ready = false;

const WASM_PATH = join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

async function getDb(): Promise<Database> {
  if (ready) return db;

  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const file = join(dir, 'video-studio.db');
  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });

  if (existsSync(file)) {
    const buf = readFileSync(file);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (user_id, key)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    script_content TEXT,
    shots_json TEXT,
    video_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // 默认 demo 用户
  const existing = db.exec("SELECT id FROM users LIMIT 1");
  if (existing.length === 0 || existing[0].values.length === 0) {
    const { createHmac, randomBytes } = await import('crypto');
    const salt = randomBytes(16).toString('hex');
    const hash = createHmac('sha256', salt).update('test123').digest('hex');
    db.run("INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)",
      ['demo', 'demo@video.studio', hash, salt]);
    save();
  }

  ready = true;
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  writeFileSync(join(process.cwd(), 'data', 'video-studio.db'), buf);
}

export { getDb, save };
