import crypto from "crypto";
import { config } from "../../config/index.js";

/**
 * @param {string} headerSignature - value of X-Fitbit-Signature
 * @param {Buffer} rawBodyBuffer   - exact bytes Fitbit POSTed (the JSON array)
 */
export function verifyFitbitSignature(headerSignature, rawBodyBuffer) {
  if (!headerSignature || !rawBodyBuffer) {
    return { ok: false, reason: "missing header/body" };
  }

  // Fitbit: signing key is CLIENT_SECRET + '&'
  const signingKey = Buffer.from(`${config.FITBIT_CLIENT_SECRET}&`, "utf8");

  const expected = crypto
    .createHmac("sha1", signingKey)
    .update(rawBodyBuffer)
    .digest("base64");

  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(headerSignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
