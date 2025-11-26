import express from "express";
import fetch from "node-fetch";
import { requireApiKey } from "../middleware/auth.js";
import { ensureFreshAccessToken } from "../services/fitbit/tokenHelpers.js";

const router = express.Router();

/**
 * GET /fitbit/proxy?path=/1/user/-/activities/steps/date/2025-11-20/2025-11-26.json
 *
 * - Validates & refreshes Fitbit token
 * - Calls https://api.fitbit.com{path}
 * - Returns JSON back to the caller (Streamlit)
 */
router.get("/fitbit/proxy", requireApiKey, async (req, res) => {
  try {
    const path = req.query.path;
    if (typeof path !== "string" || !path.startsWith("/")) {
      return res.status(400).json({ error: "missing_or_invalid_path" });
    }

    const accessToken = await ensureFreshAccessToken();

    const url = `https://api.fitbit.com${path}`;
    const fitbitResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Accept-Language": "en_US",
      },
    });

    const text = await fitbitResp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    res.status(fitbitResp.status).json(json);
  } catch (err) {
    console.error("fitbit/proxy error", err);
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
