// db.js
import Database from "better-sqlite3";

export const db = new Database("data.sqlite");
db.pragma("journal_mode = WAL");

// --- Schema setup ---
db.exec(`
CREATE TABLE IF NOT EXISTS tokens (
  userId TEXT PRIMARY KEY,
  accessToken TEXT NOT NULL,
  refreshToken TEXT NOT NULL,
  scope TEXT,
  expiresAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'subscription' | 'manual'
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  featureId TEXT NOT NULL,
  label TEXT NOT NULL,
  emotionWord TEXT,
  category TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// --- Prepared statements ---
export const upsertToken = db.prepare(`
  INSERT INTO tokens (userId, accessToken, refreshToken, scope, expiresAt)
  VALUES (@userId, @accessToken, @refreshToken, @scope, @expiresAt)
  ON CONFLICT(userId) DO UPDATE SET
    accessToken = excluded.accessToken,
    refreshToken = excluded.refreshToken,
    scope = excluded.scope,
    expiresAt = excluded.expiresAt
`);

export const getToken = db.prepare(`
  SELECT * FROM tokens WHERE userId = ?
`);

export const insertFeature = db.prepare(`
  INSERT INTO features (id, userId, createdAt, source, data)
  VALUES (@id, @userId, @createdAt, @source, @data)
`);

export const listFeatures = db.prepare(`
  SELECT id, createdAt
  FROM features
  WHERE userId = ?
  ORDER BY createdAt DESC
  LIMIT ?
  OFFSET ?
`);

export const getFeature = db.prepare(`
  SELECT * FROM features WHERE id = ? AND userId = ?
`);
