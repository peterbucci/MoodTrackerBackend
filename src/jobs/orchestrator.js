import dayjs from "dayjs";
import {
  pendingCount,
  listPendingDetailed,
  fulfillOneRequest,
} from "../db/queries/requests.js";
import { lastSyncTs } from "../db/queries/sync.js";
import { insertFeature } from "../db/queries/features.js";
import { insertLabel, linkFeatureLabel } from "../db/queries/labels.js";
import {
  fetchStepsIntraday,
  fetchHeartIntraday,
  fetchDailySummary,
  fetchCaloriesIntraday,
  fetchMostRecentExercise,
  fetchSleepRange,
  fetchRestingHr7d,
  fetchSteps7d,
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
    const [
      stepsSeries,
      heartSeries,
      dailyJson,
      caloriesJson,
      exerciseJson,
      sleepJson,
      rhr7dJson,
      steps7dJson,
    ] = await Promise.all([
      fetchStepsIntraday(accessToken, dateStr),
      fetchHeartIntraday(accessToken, dateStr),
      fetchDailySummary(accessToken, dateStr),
      fetchCaloriesIntraday(accessToken, dateStr),
      fetchMostRecentExercise(accessToken, dateStr),
      fetchSleepRange(accessToken, dateStr, 7),
      fetchRestingHr7d(accessToken, dateStr),
      fetchSteps7d(accessToken, dateStr),
    ]);

    for (const req of requests) {
      const anchor = dayjs(req.createdAt);

      // Fitbit-derived features for this anchor time
      const fitbitFeats = await buildAllFeatures({
        stepsSeries,
        heartSeries,
        dailyJson,
        caloriesJson,
        exerciseJson,
        sleepJson,
        rhr7dJson,
        steps7dJson,
        dateISO: dateStr,
        now: anchor,
      });

      // Client-provided feature object from request (if any)
      let clientFeats = {};
      if (req.clientFeatures) {
        try {
          clientFeats = JSON.parse(req.clientFeatures);
        } catch {
          clientFeats = {};
        }
      }

      // Merge client features + Fitbit features into one blob.
      // If a key collides, Fitbit data wins.
      const mergedFeats = {
        ...clientFeats,
        ...fitbitFeats,
      };

      const featureId = uuidv4();
      const nowTs = Date.now();

      insertFeature.run({
        id: featureId,
        userId,
        createdAt: nowTs,
        source: "phone-request",
        data: JSON.stringify(mergedFeats),
      });

      // If the request had a label, materialize it into labels + link table
      if (req.label && typeof req.label === "string" && req.label.trim()) {
        const labelId = uuidv4();

        insertLabel.run({
          id: labelId,
          userId,
          label: req.label.trim(),
          category: req.labelCategory || null,
          createdAt: nowTs,
        });

        linkFeatureLabel.run({
          featureId,
          labelId,
        });
      }

      fulfillOneRequest.run({ requestId: req.id, featureId });
      total += 1;
    }
  }

  return { ok: true, didFetch: true, requestsFulfilled: total };
}
