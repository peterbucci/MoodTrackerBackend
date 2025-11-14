import dayjs from "dayjs";
import {
  pendingCount,
  listPendingDetailed,
  fulfillOneRequest,
} from "../db/queries/requests.js";
import { lastSyncTs } from "../db/queries/sync.js";
import { insertFeature } from "../db/queries/features.js";
import {
  fetchStepsIntraday,
  fetchHeartIntraday,
  fetchDailySummary,
  fetchCaloriesIntraday,
  fetchMostRecentExercise,
  fetchSleepRange,
  fetchRestingHr7d,
} from "../services/fitbit/api.js";
import { getAccessToken } from "../services/fitbit/oauth.js";
import { buildAllFeatures } from "../services/features/index.js";
import { v4 as uuidv4 } from "uuid";

const REQUIRE_SYNC_WITHIN_MS = 1;

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

  const pending = listPendingDetailed.all(userId);
  if (!pending?.length)
    return { ok: true, didFetch: false, reason: "no-pending" };

  // Group by date (YYYY-MM-DD)
  const groups = new Map();
  for (const r of pending) {
    const anchor = dayjs(r.createdAt);
    const dateStr = anchor.format("YYYY-MM-DD");
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr).push(r);
  }

  const accessToken = await getAccessToken(userId);
  let total = 0;

  for (const [dateStr, requests] of groups.entries()) {
    // 🔹 Fetch Fitbit once per date (4 calls total for Tier-1 + steps)
    const [
      stepsSeries,
      heartSeries,
      dailyJson,
      caloriesJson,
      exerciseJson,
      sleepJson,
      rhr7dJson,
    ] = await Promise.all([
      fetchStepsIntraday(accessToken, dateStr),
      fetchHeartIntraday(accessToken, dateStr),
      fetchDailySummary(accessToken, dateStr),
      fetchCaloriesIntraday(accessToken, dateStr),
      fetchMostRecentExercise(accessToken, dateStr),
      fetchSleepRange(accessToken, dateStr, 7),
      fetchRestingHr7d(accessToken, dateStr),
    ]);

    // Fulfill each request with its own anchor time using the SAME pre-fetched blobs
    for (const req of requests) {
      const anchor = dayjs(req.createdAt);

      const feats = await buildAllFeatures({
        stepsSeries,
        heartSeries,
        dailyJson,
        caloriesJson,
        exerciseJson,
        sleepJson,
        rhr7dJson,
        dateISO: dateStr,
        now: anchor,
      });

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
