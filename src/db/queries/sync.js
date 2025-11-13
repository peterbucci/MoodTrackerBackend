import { db } from "../index.js";

export const logSync = db.prepare(`
  INSERT INTO sync_log (id, userId, createdAt)
  VALUES (@id, @userId, @createdAt)
`);

export const lastSyncTs = db.prepare(`
  SELECT createdAt FROM sync_log WHERE userId = ? ORDER BY createdAt DESC LIMIT 1
`);
