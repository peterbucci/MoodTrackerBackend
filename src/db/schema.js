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

  -- normalized labels table
  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    label TEXT NOT NULL,     
    category TEXT,            
    createdAt INTEGER NOT NULL
  );

  -- 1:1 link between a feature row and a label row
  -- PRIMARY KEY(featureId) => each feature has at most one label
  -- UNIQUE(labelId)        => each label belongs to exactly one feature
  CREATE TABLE IF NOT EXISTS feature_labels (
    featureId TEXT PRIMARY KEY,
    labelId TEXT NOT NULL UNIQUE,
    FOREIGN KEY(featureId) REFERENCES features(id),
    FOREIGN KEY(labelId) REFERENCES labels(id)
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
    featureId TEXT,               
    source TEXT NOT NULL DEFAULT 'phone', -- or 'manual' later
    clientFeatures TEXT,          -- JSON from app (nullable)
    label TEXT,                   -- raw emotion string from app
    labelCategory TEXT         
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );
  `);
}
