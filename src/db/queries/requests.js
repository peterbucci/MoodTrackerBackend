import { db } from "../index.js";

export const insertRequest = db.prepare(`
  INSERT INTO requests (
    id,
    userId,
    createdAt,
    status,
    source,
    clientFeatures,
    label,
    labelCategory
  )
  VALUES (
    @id,
    @userId,
    @createdAt,
    'pending',
    @source,
    @clientFeatures,
    @label,
    @labelCategory
  )
`);

export const pendingCount = db.prepare(`
  SELECT COUNT(*) AS c
  FROM requests
  WHERE userId = ? AND status = 'pending'
`);

export const listPendingDetailed = db.prepare(`
  SELECT
    id,
    userId,
    createdAt,
    clientFeatures,
    label,
    labelCategory
  FROM requests
  WHERE userId = ? AND status = 'pending'
  ORDER BY createdAt ASC
`);

export const fulfillOneRequest = db.prepare(`
  UPDATE requests
  SET status = 'fulfilled', featureId = @featureId
  WHERE id = @requestId
`);

export const listRequests = db.prepare(`
  SELECT
    id,
    createdAt,
    status,
    featureId,
    source,
    clientFeatures, 
    label,
    labelCategory
  FROM requests
  WHERE userId = ?
  ORDER BY createdAt DESC
`);

export const listRequestsByCreatedAt = db.prepare(`
  SELECT *
  FROM requests
  WHERE userId = @userId
    AND createdAt = @createdAt
  ORDER BY createdAt DESC
`);

export function listRequestsByCreatedAtBatch(userId, timestamps) {
  if (!timestamps || timestamps.length === 0) return [];

  const placeholders = timestamps.map(() => "?").join(", ");

  const stmt = db.prepare(
    `
    SELECT *
    FROM requests
    WHERE userId = ?
      AND createdAt IN (${placeholders})
    ORDER BY createdAt DESC
    `
  );

  return stmt.all(userId, ...timestamps);
}
