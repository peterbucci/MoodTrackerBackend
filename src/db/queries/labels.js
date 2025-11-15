import { db } from "../index.js";

export const insertLabel = db.prepare(`
  INSERT INTO labels (id, userId, label, category, createdAt)
  VALUES (@id, @userId, @label, @category, @createdAt)
`);

export const linkFeatureLabel = db.prepare(`
  INSERT INTO feature_labels (featureId, labelId)
  VALUES (@featureId, @labelId)
`);

export const getLabelForFeature = db.prepare(`
  SELECT l.*
  FROM labels l
  JOIN feature_labels fl ON fl.labelId = l.id
  WHERE fl.featureId = ? AND l.userId = ?
`);
