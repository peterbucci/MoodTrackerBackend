import fetch from "node-fetch";
import { config } from "../../config/index.js";
import { upsertToken, getToken } from "../../db/queries/tokens.js";

function basicAuth() {
  const s = Buffer.from(
    `${config.FITBIT_CLIENT_ID}:${config.FITBIT_CLIENT_SECRET}`
  ).toString("base64");
  return `Basic ${s}`;
}

export async function tokenExchange(code) {
  const params = new URLSearchParams();
  params.set("client_id", config.FITBIT_CLIENT_ID);
  params.set("grant_type", "authorization_code");
  params.set("redirect_uri", config.FITBIT_REDIRECT_URI);
  params.set("code", code);

  const r = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!r.ok) throw new Error(`Token HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function tokenRefresh(userId, refreshToken) {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refreshToken);

  const r = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!r.ok) throw new Error(`Refresh HTTP ${r.status}: ${await r.text()}`);
  const json = await r.json();
  upsertToken.run({
    userId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    scope: json.scope,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

export async function getAccessToken(userId) {
  const row = getToken.get(userId);
  if (!row) throw new Error("No token for user");
  if (Date.now() + 60_000 < row.expiresAt) return row.accessToken;
  return tokenRefresh(userId, row.refreshToken);
}
