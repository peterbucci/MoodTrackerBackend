import fetch from "node-fetch";
import { config } from "../../config/index.js";

export async function subscribeActivities(accessToken) {
  const url =
    "https://api.fitbit.com/1/user/-/activities/apiSubscriptions/1.json";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Fitbit-Subscriber-Id": config.FITBIT_SUBSCRIBER_ID,
      "Content-Length": "0",
    },
  });

  if (!r.ok && r.status !== 409) {
    throw new Error(`Subscription HTTP ${r.status}: ${await r.text()}`);
  }
}
