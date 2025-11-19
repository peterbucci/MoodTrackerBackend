import express from "express";
import { getAnyUser, getAnyTokenRow } from "../db/queries/tokens.js";
import { listFeatures, getFeatureWithLabel } from "../db/queries/features.js";
import {
  deleteLink,
  deleteLabel,
  deleteFeatureOnly,
  getLabelIdForFeature,
} from "../db/queries/features.js";

const router = express.Router();

router.get("/features", (req, res) => {
  const row = getAnyUser.get();
  if (!row) return res.json([]);
  const list = listFeatures.all(row.userId, 50, 0);
  res.json(list);
});

/**
 * Get a single feature with its label/category for the current user.
 */
router.get("/features/:id", (req, res) => {
  const userRow = getAnyUser.get();
  if (!userRow) {
    return res.status(404).json({ error: "no user" });
  }

  const userId = userRow.userId;
  const featureId = req.params.id;

  const row = getFeatureWithLabel.get(featureId, userId);
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  let data;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = null;
  }

  const label = {
    id: row.labelId,
    label: row.label,
    category: row.labelCategory,
    createdAt: row.labelCreatedAt,
  };

  res.json({
    ok: true,
    feature: {
      id: row.featureId,
      userId: row.userId,
      createdAt: row.featureCreatedAt,
      source: row.source,
      data,
    },
    label,
  });
});

router.delete("/features/:id", (req, res) => {
  const featureId = req.params.id;
  const user = getAnyUser.get();
  if (!user) return res.status(401).json({ ok: false, error: "no user" });

  const userId = user.userId;

  // 1. get labelId for this feature (if exists)
  const row = getLabelIdForFeature.get(featureId);
  const labelId = row?.labelId || null;

  // 2. delete link
  deleteLink.run(featureId);

  // 3. delete label
  if (labelId) {
    deleteLabel.run(labelId, userId);
  }

  // 4. delete feature
  deleteFeatureOnly.run(featureId, userId);

  return res.json({
    ok: true,
    deletedFeatureId: featureId,
    deletedLabelId: labelId,
  });
});

// Small health/debug endpoints
router.get("/admin/health", (req, res) =>
  res.json({ ok: true, ts: Date.now() })
);

router.get("/debug/token", (req, res) => {
  const row = getAnyTokenRow.get();
  if (!row) return res.status(404).json({ error: "no token" });
  res.json({ userId: row.userId, scope: row.scope, expiresAt: row.expiresAt });
});

export default router;
