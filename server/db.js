// Butuh Node >= 22.13 (node:sqlite bawaan, tanpa dependensi native)
import { DatabaseSync } from 'node:sqlite'
export const db = new DatabaseSync(process.env.DB_PATH || 'mikrolab.db')
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS topologies (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL, slug TEXT UNIQUE, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS progress (user_id INTEGER, lab_id TEXT, passed_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, lab_id));
CREATE TABLE IF NOT EXISTS topology_versions (id INTEGER PRIMARY KEY, topo_id INTEGER NOT NULL, user_id INTEGER NOT NULL, ver INTEGER NOT NULL, summary TEXT, data TEXT NOT NULL, ts TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (topo_id, ver));
CREATE TABLE IF NOT EXISTS metrics (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, dev TEXT NOT NULL, up INTEGER NOT NULL, total INTEGER NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_versions_topo ON topology_versions (topo_id, ver);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON metrics (user_id, ts);
`)
