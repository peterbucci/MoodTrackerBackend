import crypto from "crypto";
import { config } from "../../config/index.js";

// Tries several common payload variants and HMAC algos (sha1/sha256)
export function verifyWebhookSignature(headerSignature, rawBuffer, rawString) {
  const candidates = [{ name: "raw", data: rawBuffer }];

  candidates.push({ name: "utf8", data: Buffer.from(rawString || "", "utf8") });
  candidates.push({
    name: "raw+\\n",
    data: Buffer.concat([rawBuffer, Buffer.from("\n")]),
  });
  candidates.push({
    name: "raw+\\r\\n",
    data: Buffer.concat([rawBuffer, Buffer.from("\r\n")]),
  });

  try {
    const min = JSON.stringify(JSON.parse(rawString));
    if (min)
      candidates.push({ name: "json-min", data: Buffer.from(min, "utf8") });
  } catch {}

  const keys = [
    config.FITBIT_CLIENT_SECRET,
    config.FITBIT_VERIFICATION_CODE,
    config.FITBIT_SUBSCRIBER_ID,
  ].filter(Boolean);

  const algos = ["sha1", "sha256"];

  for (const key of keys) {
    for (const payload of candidates) {
      for (const algo of algos) {
        const mac = crypto
          .createHmac(algo, key)
          .update(payload.data)
          .digest("base64");
        if (mac === headerSignature) {
          return { ok: true, key, payload: payload.name, algo };
        }
      }
    }
  }
  return { ok: false };
}
