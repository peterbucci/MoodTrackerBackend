// src/routes/requests.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getAnyUser, getAnyTokenRow } from "../db/queries/tokens.js";
import {
  insertRequest,
  pendingCount,
  listRequests,
} from "../db/queries/requests.js";
import { tryFulfillPending } from "../jobs/orchestrator.js";

const router = express.Router();

/**
 * Queue a new build request. If a recent sync exists, we try to fulfill now.
 */
router.post("/requests", async (req, res) => {
  const tok = getAnyTokenRow.get();
  if (!tok) {
    return res
      .status(400)
      .json({ error: "link a Fitbit user first (/oauth/start)" });
  }

  const id = uuidv4();
  const createdAt = Date.now();

  insertRequest.run({
    id,
    userId: tok.userId,
    createdAt,
    source: "phone",
  });

  // Try to fulfill immediately if recent sync allows; otherwise stay queued
  const fulfillment = await tryFulfillPending(tok.userId, {
    allowWithoutRecentSync: false,
  });

  res.json({
    ok: true,
    requestId: id,
    requestCreatedAt: createdAt,
    pendingCount: pendingCount.get(tok.userId)?.c ?? 0,
    fulfillment,
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

  const list = listRequests.all(row.userId);
  res.json({
    ok: true,
    userId: row.userId,
    count: list.length,
    requests: list,
  });
});

export default router;
