import express from "express";
import { config } from "../config/index.js";
import { tokenExchange } from "../services/fitbit/oauth.js";
import { subscribeActivities } from "../services/fitbit/subscription.js";
import {
  upsertToken,
  getAnyTokenRow,
  clearTokens,
} from "../db/queries/tokens.js";

const router = express.Router();

router.get("/oauth/start", (req, res) => {
  const force = req.query.force === "1";
  const row = getAnyTokenRow.get();

  if (row && Date.now() < row.expiresAt && !force) {
    return res.redirect("/oauth/done");
  }

  const params = new URLSearchParams({
    client_id: config.FITBIT_CLIENT_ID,
    response_type: "code",
    redirect_uri: config.FITBIT_REDIRECT_URI,
    scope: [
      "activity",
      "heartrate",
      "sleep",
      "nutrition",
      "profile",
      "settings",
      "weight",
      "respiratory_rate",
      "temperature",
      "oxygen_saturation",
    ].join(" "),
    include_granted_scopes: "true",
  });
  if (force) params.set("prompt", "consent");

  return res.redirect(
    `https://www.fitbit.com/oauth2/authorize?${params.toString()}`
  );
});

router.get("/oauth/done", (req, res) => {
  const row = getAnyTokenRow.get();
  if (!row) return res.redirect("/oauth/start?force=1");
  res.send(
    `<pre>Already linked Fitbit user ${row.userId}.
Token valid until ${new Date(row.expiresAt).toISOString()}.
No action needed. To re-link, hit /oauth/start?force=1</pre>`
  );
});

router.get("/oauth/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const t = await tokenExchange(code);
    const userId = t.user_id;
    upsertToken.run({
      userId,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      scope: t.scope,
      expiresAt: Date.now() + t.expires_in * 1000,
    });
    await subscribeActivities(t.access_token);

    res.send(`<!DOCTYPE html>
<html>
  <body style="font-family: system-ui; padding: 16px;">
    <h2>Fitbit linked ✅</h2>
    <p>You can close this window and return to the app.</p>
  </body>
</html>`);
  } catch (e) {
    res.status(500).send(`<pre>${String(e)}</pre>`);
  }
});

// Is there a valid token in the DB?
router.get("/oauth/status", (req, res) => {
  const row = getAnyTokenRow.get();

  if (!row) {
    return res.json({
      linked: false,
      userId: null,
      expiresAt: null,
    });
  }

  const stillValid = Date.now() < row.expiresAt;

  res.json({
    linked: stillValid,
    userId: row.userId,
    expiresAt: row.expiresAt,
  });
});

// Unlink / "logout" – clears tokens
router.post("/oauth/unlink", (req, res) => {
  clearTokens.run();
  // Could also try to unsubscribe from Fitbit here later
  res.json({ ok: true });
});

export default router;
