import express from "express";
import { verifyFitbitSignature } from "../services/fitbit/verifySig.js";
import { scheduleCoalesced } from "../jobs/coalesce.js";
import { config } from "../config/index.js";
import { logSync } from "../db/queries/sync.js";
import { pendingCount } from "../db/queries/requests.js";
import { tryFulfillPending } from "../jobs/orchestrator.ts";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.get("/fitbit/webhook", (req, res) => {
  const verify = req.query.verify;
  if (verify && verify === config.FITBIT_VERIFICATION_CODE) {
    return res.status(204).send();
  }
  return res.status(404).send("Not Found");
});

router.post("/fitbit/webhook", async (req, res) => {
  try {
    const hdr = req.get("X-Fitbit-Signature") || "";
    const ok = verifyFitbitSignature(hdr, req.rawBodyBuffer);

    // ACK quickly (Fitbit requires fast response).
    if (!ok) {
      return res.status(403).send();
    }
    res.status(204).send();

    // Normalize body → ownerIds
    const body = req.body;
    const notifications = Array.isArray(body)
      ? body
      : body?.collectionType
      ? [body]
      : body?.ownerId
      ? [body]
      : body?.[0]
      ? body
      : [];

    const owners = new Set(notifications.map((n) => n.ownerId).filter(Boolean));

    for (const userId of owners) {
      // 1) Log the sync
      logSync.run({ id: uuidv4(), userId, createdAt: Date.now() });

      // 2) Count queue and log it
      const pc = pendingCount.get(userId)?.c ?? 0;
      console.log(`[sync] user=${userId} pendingRequests=${pc}`);

      // 3) Only fetch if there are pending requests. Coalesce to avoid storms (repeated fetches).
      if (pc > 0) {
        scheduleCoalesced(userId, config.FETCH_DEBOUNCE_MS, async () => {
          const out = await tryFulfillPending(userId);
          console.log(`[sync->fulfill] user=${userId}`, out);
        });
      }
    }
  } catch {
    return res.status(403).send();
  }
});

export default router;
