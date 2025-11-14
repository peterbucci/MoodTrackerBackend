import express from "express";
import { getAnyUser, getAnyTokenRow } from "../db/queries/tokens.js";
import { listFeatures, getFeature } from "../db/queries/features.js";

const router = express.Router();

// Simple read API (same behavior as before)
router.get("/features", (req, res) => {
  const row = getAnyUser.get();
  if (!row) return res.json([]);
  const list = listFeatures.all(row.userId, 50, 0);
  res.json(list);
});

router.get("/features/:id", (req, res) => {
  const row = getAnyUser.get();
  if (!row) return res.status(404).json({ error: "no user" });
  const it = getFeature.get(req.params.id, row.userId);
  if (!it) return res.status(404).json({ error: "not found" });
  res.json({ id: it.id, createdAt: it.createdAt, data: JSON.parse(it.data) });
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
