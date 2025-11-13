import { db } from "../index.js";

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

export const latestFeatureForUser = db.prepare(`
  SELECT id, createdAt FROM features
  WHERE userId = ?
  ORDER BY createdAt DESC LIMIT 1
`);
