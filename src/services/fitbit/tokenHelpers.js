import fetch from "node-fetch";
import { config } from "../config/index.js";
import { getAnyTokenRow, upsertToken } from "../db/queries/tokens.js";

const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";

export async function ensureFreshAccessToken() {
  const row = getAnyTokenRow.get();
  if (!row) {
    throw new Error(
      "No Fitbit token row in DB. Link Fitbit first via /oauth/start."
    );
  }

  const now = Date.now();
  // 60s buffer so we don't cut it too close to expiry
  if (now < row.expiresAt - 60_000) {
    return row.accessToken;
  }

  // Need to refresh
  const basicAuth = Buffer.from(
    `${config.FITBIT_CLIENT_ID}:${config.FITBIT_CLIENT_SECRET}`
  ).toString("base64");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.refreshToken,
  });

  const resp = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Fitbit token refresh failed: ${resp.status} ${body}`);
  }

  const t = await resp.json();

  // Save new tokens
  upsertToken.run({
    userId: row.userId,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    scope: t.scope,
    expiresAt: Date.now() + t.expires_in * 1000,
  });

  return t.access_token;
}
