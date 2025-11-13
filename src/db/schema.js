export function applySchema(db) {
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
    source TEXT NOT NULL, -- 'subscription' | 'phone-request'
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

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    status TEXT NOT NULL,         -- 'pending' | 'fulfilled' | 'canceled'
    featureId TEXT,               -- set when fulfilled (many requests -> one feature)
    source TEXT NOT NULL DEFAULT 'phone' -- or 'manual' later
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );
  `);
}
