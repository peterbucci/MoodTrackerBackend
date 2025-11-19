import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getAnyUser, getAnyTokenRow } from "../db/queries/tokens.js";
import {
  insertRequest,
  pendingCount,
  listRequests,
} from "../db/queries/requests.js";

const router = express.Router();

/**
 * Queue a new build request.
 */
router.post("/requests", async (req, res) => {
  const tok = getAnyTokenRow.get();
  if (!tok) {
    return res
      .status(400)
      .json({ error: "link a Fitbit user first (/oauth/start)" });
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      ok: false,
      error: "request body required",
    });
  }

  const id = uuidv4();

  const { clientFeatures, label, category } = req.body;

  if (
    clientFeatures == null &&
    (label == null || label === "") &&
    (category == null || category === "")
  ) {
    return res.status(400).json({
      ok: false,
      error: "must include clientFeatures, label, and category",
    });
  }

  let createdAt = Date.now();

  insertRequest.run({
    id,
    userId: tok.userId,
    createdAt,
    source: "phone",
    clientFeatures: JSON.stringify(clientFeatures),
    label,
    labelCategory: category,
  });

  res.json({
    ok: true,
    requestId: id,
    requestCreatedAt: createdAt,
    pendingCount: pendingCount.get(tok.userId)?.c ?? 0,
  });
});

/**
 * Queue status for the current user.
 */
router.get("/requests/status", (req, res) => {
  const row = getAnyUser.get();
  if (!row) return res.status(404).json({ error: "no user" });
  const pc = pendingCount.get(row.userId)?.c ?? 0;
  res.json({ ok: true, userId: row.userId, pendingCount: pc });
});

/**
 * List all requests (most recent first) for the current user.
 */
router.get("/requests/all", (req, res) => {
  const row = getAnyUser.get();
  if (!row) return res.status(404).json({ error: "no user" });

  const rawList = listRequests.all(row.userId);

  const requests = rawList.map((r) => {
    let clientFeatures = null;
    if (r.clientFeatures) {
      try {
        clientFeatures = JSON.parse(r.clientFeatures);
      } catch {
        clientFeatures = null;
      }
    }
    return {
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      featureId: r.featureId,
      source: r.source,
      label: r.label,
      labelCategory: r.labelCategory,
      clientFeatures,
    };
  });

  res.json({
    ok: true,
    userId: row.userId,
    count: requests.length,
    requests,
  });
});

export default router;
