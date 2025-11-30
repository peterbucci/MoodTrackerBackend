export function applyDesktopSchema(db) {
  db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    source TEXT
  );

  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feature_labels (
    feature_id TEXT PRIMARY KEY REFERENCES features(id) ON DELETE CASCADE,
    label_id   TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feature_context (
    feature_id TEXT PRIMARY KEY REFERENCES features(id) ON DELETE CASCADE,
    calendarBusyNow INTEGER,
    lastCalendarEventType TEXT,
    notificationBurst5m INTEGER,
    notificationCount60m INTEGER,
    daylightNowFlag INTEGER,
    daylightMinsRemaining INTEGER,
    weatherTempF REAL,
    weatherFeelsLikeF REAL,
    weatherPrecipMm REAL,
    outdoorAQI REAL,
    lat REAL,
    lon REAL
  );
  `);
}
