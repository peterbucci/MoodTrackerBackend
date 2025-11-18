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
import { buildGeoAndTimeFeatures } from "../services/features/geoTimeFeatures.js";
import tzLookup from "tz-lookup";

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
  console.log("1");
  const pc = pendingCount.get(userId)?.c ?? 0;
  if (pc === 0) return { ok: true, didFetch: false, reason: "no-pending" };
  console.log("2");
  const pending = listPendingDetailed.all(userId);
  if (!pending?.length) {
    return { ok: true, didFetch: false, reason: "no-pending" };
  }
  console.log("3");
  // Group by date (YYYY-MM-DD)
  const groups = new Map();
  for (const r of pending) {
    const clientFeats = await JSON.parse(r.clientFeatures);
    const { lat, lon } = clientFeats;
    const tz = tzLookup(lat, lon);
    const anchor = dayjs(r.createdAt).tz(tz);
    const dateStr = anchor.format("YYYY-MM-DD");
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr).push(r);
  }
  console.log("4");
  const accessToken = await getAccessToken(userId);
  let total = 0;
  console.log("5");
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
    console.log("6");
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

      // Client-provided features (if any)
      let clientFeats = {};
      if (req.clientFeatures) {
        try {
          clientFeats = JSON.parse(req.clientFeatures);
        } catch {
          clientFeats = {};
        }
      }
      const { lat, lon, ...restClientFeats } = clientFeats;

      // Geo/time/cluster/weather from lat/lon + anchor
      const geoTimeFeats = await buildGeoAndTimeFeatures({
        lat,
        lon,
        anchor,
      });

      // Merge order: client → fitbit → geo/time (geo/time wins on conflicts)
      const mergedFeats = {
        ...fitbitFeats,
        ...restClientFeats,
        ...geoTimeFeats,
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

      // Persist label linkage if present on request
      maybeSaveLabelForFeature({ req, userId, featureId, nowTs });

      fulfillOneRequest.run({ requestId: req.id, featureId });
      total += 1;
    }
  }

  return { ok: true, didFetch: true, requestsFulfilled: total };
}
