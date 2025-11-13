import dayjs from "dayjs";
import {
  pendingCount,
  listPendingDetailed,
  fulfillOneRequest,
} from "../db/queries/requests.js";
import { lastSyncTs } from "../db/queries/sync.js";
import { insertFeature } from "../db/queries/features.js";
import { fetchStepsIntraday } from "../services/fitbit/api.js";
import { getAccessToken } from "../services/fitbit/oauth.js";
import { buildAllFeatures } from "../services/features/index.js";
import { v4 as uuidv4 } from "uuid";

const REQUIRE_SYNC_WITHIN_MS = 1; // 30m

export async function tryFulfillPending(
  userId,
  { allowWithoutRecentSync = false } = {}
) {
  const pc = pendingCount.get(userId)?.c ?? 0;
  if (pc === 0) return { ok: true, didFetch: false, reason: "no-pending" };

  const last = lastSyncTs.get(userId)?.createdAt ?? 0;
  const recentEnough = Date.now() - last <= REQUIRE_SYNC_WITHIN_MS;
  if (!allowWithoutRecentSync && !recentEnough) {
    return {
      ok: true,
      didFetch: false,
      reason: "waiting-for-sync",
      pending: pc,
      lastSync: last,
    };
  }

  // 1) Load all pending requests with their anchor timestamps
  const pending = listPendingDetailed.all(userId);
  if (!pending?.length)
    return { ok: true, didFetch: false, reason: "no-pending" };

  // 2) Group requests by anchor date so we fetch intraday once per date
  const groups = new Map(); // dateStr -> array of requests
  for (const r of pending) {
    const anchor = dayjs(r.createdAt);
    const dateStr = anchor.format("YYYY-MM-DD");
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr).push(r);
  }

  // 3) Fetch intraday per date and fulfill each request with its own features
  const accessToken = await getAccessToken(userId);
  let total = 0;
  for (const [dateStr, requests] of groups.entries()) {
    const stepsSeries = await fetchStepsIntraday(accessToken, dateStr);

    for (const req of requests) {
      const anchor = dayjs(req.createdAt);
      // Build features with "now" anchored to the request time
      const feats = await buildAllFeatures({ stepsSeries, now: anchor });

      const featureId = uuidv4();
      insertFeature.run({
        id: featureId,
        userId,
        createdAt: Date.now(),
        source: "phone-request",
        data: JSON.stringify(feats),
      });

      fulfillOneRequest.run({ requestId: req.id, featureId });
      total += 1;
    }
  }

  return { ok: true, didFetch: true, requestsFulfilled: total };
}
