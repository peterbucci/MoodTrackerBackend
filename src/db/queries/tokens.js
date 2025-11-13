import { db } from "../index.js";

export const upsertToken = db.prepare(`
  INSERT INTO tokens (userId, accessToken, refreshToken, scope, expiresAt)
  VALUES (@userId, @accessToken, @refreshToken, @scope, @expiresAt)
  ON CONFLICT(userId) DO UPDATE SET
    accessToken = excluded.accessToken,
    refreshToken = excluded.refreshToken,
    scope = excluded.scope,
    expiresAt = excluded.expiresAt
`);

export const getToken = db.prepare(`SELECT * FROM tokens WHERE userId = ?`);

export const getAnyTokenRow = db.prepare(`SELECT * FROM tokens LIMIT 1`);

export const getAnyUser = db.prepare(`SELECT userId FROM tokens LIMIT 1`);
