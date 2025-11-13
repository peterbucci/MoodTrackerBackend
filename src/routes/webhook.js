import express from "express";
import { verifyWebhookSignature } from "../services/fitbit/webhookVerify.js";
import { scheduleCoalesced } from "../jobs/coalesce.js";
import { runFetchForUser } from "../jobs/fetchJob.js";
import { config } from "../config/index.js";

const router = express.Router();

// Verify endpoint
router.get("/fitbit/webhook", (req, res) => {
  const verify = req.query.verify;
  if (verify && verify === config.FITBIT_VERIFICATION_CODE) {
    return res.status(204).send();
  }
  return res.status(404).send("Not Found");
});

// Notifications
router.post("/fitbit/webhook", async (req, res) => {
  try {
    const hdr = req.get("X-Fitbit-Signature") || "";
    const { ok } = verifyWebhookSignature(hdr, req.rawBodyBuffer, req.rawBody);

    // While you’re still validating variants, ACK 204 to stop retries.
    // Later, enforce `ok` === true and respond 403 when invalid.
    res.status(204).send();

    // Normalize notifications -> owners
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
      scheduleCoalesced(userId, config.FETCH_DEBOUNCE_MS, () => {
        runFetchForUser(userId);
      });
    }
  } catch (e) {
    // Best effort ACK to avoid storms
    res.status(204).send();
  }
});

export default router;
