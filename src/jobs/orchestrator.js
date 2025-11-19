import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";

import {
  pendingCount,
  listPendingDetailed,
  fulfillOneRequest,
} from "../db/queries/requests.js";
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
import { buildGeoAndTimeFeatures } from "../services/features/buildGeoAndTimeFeatures.js";

// Helper: persist label if request has one
function maybeSaveLabelForFeature({ req, userId, featureId, nowTs }) {
  if (!req.label || typeof req.label !== "string" || !req.label.trim()) {
    return;
  }

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

export async function tryFulfillPending(userId) {
  const pc = pendingCount.get(userId)?.c ?? 0;
  if (pc === 0) return { ok: true, didFetch: false, reason: "no-pending" };

  const requests = listPendingDetailed.all(userId);

  const byDate = new Map();

  // FIRST PASS: bucket by date using anchorMs
  for (const r of requests) {
    let clientFeats = {};
    try {
      clientFeats = JSON.parse(r.clientFeatures);
    } catch {}

    const anchorMs = clientFeats.anchorMs ?? r.createdAt;
    const anchor = dayjs(anchorMs);
    const dateStr = anchor.format("YYYY-MM-DD");

    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr).push({ r, clientFeats, anchor });
  }

  const accessToken = await getAccessToken(userId);

  // SECOND PASS: process groups
  for (const [dateStr, list] of byDate.entries()) {
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

    for (const { r, clientFeats, anchor } of list) {
      const { lat, lon, ...restClientFeats } = clientFeats;

      // Build Fitbit features
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

      // Geo features
      const geoTimeFeats =
        typeof lat === "number" && typeof lon === "number"
          ? await buildGeoAndTimeFeatures({ lat, lon, anchor })
          : {};

      // Merge
      const merged = {
        ...fitbitFeats,
        ...restClientFeats,
        ...geoTimeFeats,
      };

      const featureId = uuidv4();
      const ts = Date.now();

      insertFeature.run({
        id: featureId,
        userId,
        createdAt: ts,
        source: "phone-request",
        data: JSON.stringify(merged),
      });

      maybeSaveLabelForFeature({ req: r, userId, featureId, nowTs: ts });
      fulfillOneRequest.run({ requestId: r.id, featureId });
    }
  }

  return { ok: true, didFetch: true, requestsFulfilled: total };
}
