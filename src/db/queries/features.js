import { db } from "../index.js";

export const insertFeature = db.prepare(`
  INSERT INTO features (id, userId, createdAt, source, data)
  VALUES (@id, @userId, @createdAt, @source, @data)
`);

export const listFeatures = db.prepare(`
  SELECT
    f.id,
    f.createdAt,
    l.label AS label
  FROM features f
  LEFT JOIN feature_labels fl
    ON fl.featureId = f.id
  LEFT JOIN labels l
    ON l.id = fl.labelId
   AND l.userId = f.userId
  WHERE f.userId = ?
  ORDER BY f.createdAt DESC
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

export const getFeatureWithLabel = db.prepare(`
  SELECT
    f.id          AS featureId,
    f.userId      AS userId,
    f.createdAt   AS featureCreatedAt,
    f.source      AS source,
    f.data        AS data,
    l.id          AS labelId,
    l.label       AS label,
    l.category    AS labelCategory,
    l.createdAt   AS labelCreatedAt
  FROM features f
  LEFT JOIN feature_labels fl ON fl.featureId = f.id
  LEFT JOIN labels l ON l.id = fl.labelId
  WHERE f.id = ? AND f.userId = ?
`);
