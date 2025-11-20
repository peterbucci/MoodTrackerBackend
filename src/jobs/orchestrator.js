import {
  fetchStepsIntraday,
  fetchDailySummary,
  fetchCaloriesIntraday,
  fetchMostRecentExercise,
  fetchSteps7d,
  fetchAzmIntraday,
} from "../services/fitbit/activity.ts";
import {
  fetchHeartIntraday,
  fetchRestingHr7d,
  fetchHrvDaily,
  fetchHrvIntraday,
} from "../services/fitbit/heart.ts";
import {
  fetchSleepRange,
  fetchBreathingRateIntraday,
} from "../services/fitbit/sleep.ts";
import {
  fetchSpo2Daily,
  fetchTempSkinDaily,
} from "../services/fitbit/health.ts";
import {
  fetchNutritionDaily,
  fetchWaterDaily,
} from "../services/fitbit/nutrition.ts";
import { getAccessToken } from "../services/fitbit/oauth.js";
import { insertFeature } from "../db/queries/features.js";
import { insertLabel, linkFeatureLabel } from "../db/queries/labels.js";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import tzLookup from "tz-lookup";
import {
  fulfillOneRequest,
  pendingCount,
  listPendingDetailed,
} from "../db/queries/requests.js";
import { buildAllFeatures } from "../services/features/index.js";
import { buildGeoAndTimeFeatures } from "../services/features/buildGeoAndTimeFeatures.js";
import { logFetchedFitbitData } from "../utils/logger.js";

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
  // Fix this
  const pc = pendingCount.get(userId)?.c ?? 0;
  if (pc === 0) return { ok: true, didFetch: false, reason: "no-pending" };

  const pending = listPendingDetailed.all(userId);
  if (!pending?.length) {
    return { ok: true, didFetch: false, reason: "no-pending" };
  }

  // -------------------------------
  // Group requests by DATE using SERVER time in user's timezone
  // -------------------------------
  const groups = new Map();

  for (const r of pending) {
    let clientFeats = {};

    try {
      clientFeats = JSON.parse(r.clientFeatures) || {};
    } catch {}

    const { lat, lon, anchorMs } = clientFeats;

    const tz =
      typeof lat === "number" && typeof lon === "number"
        ? tzLookup(lat, lon)
        : "UTC";

    const base =
      typeof anchorMs === "number" && Number.isFinite(anchorMs)
        ? dayjs(anchorMs)
        : dayjs();

    const anchor = base.tz(tz);
    const dateStr = anchor.format("YYYY-MM-DD");

    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr).push(r);
  }
  const accessToken = await getAccessToken(userId);
  let total = 0;

  // -------------------------------
  // For each date, fetch Fitbit data and fulfill requests
  // -------------------------------
  for (const [dateStr, requests] of groups.entries()) {
    const [
      stepsSeries,
      heartSeries,
      azmSeries,
      breathingSeries,
      hrvJson,
      dailyJson,
      caloriesJson,
      exerciseJson,
      sleepJson,
      rhr7dJson,
      steps7dJson,
      spo2Daily,
      tempSkinDaily,
      nutritionDaily,
      waterDaily,
      hrvIntraday,
    ] = await Promise.all([
      fetchStepsIntraday(accessToken, dateStr),
      fetchHeartIntraday(accessToken, dateStr),
      fetchAzmIntraday(accessToken, dateStr),
      fetchBreathingRateIntraday(accessToken, dateStr),
      fetchHrvDaily(accessToken, dateStr),
      fetchDailySummary(accessToken, dateStr),
      fetchCaloriesIntraday(accessToken, dateStr),
      fetchMostRecentExercise(accessToken, dateStr),
      fetchSleepRange(accessToken, dateStr, 7),
      fetchRestingHr7d(accessToken, dateStr),
      fetchSteps7d(accessToken, dateStr),
      fetchSpo2Daily(accessToken, dateStr),
      fetchTempSkinDaily(accessToken, dateStr),
      fetchNutritionDaily(accessToken, dateStr),
      fetchWaterDaily(accessToken, dateStr),
      fetchHrvIntraday(accessToken, dateStr),
    ]);

    for (const req of requests) {
      // logFetchedFitbitData(dateStr, {
      //   stepsSeries,
      //   heartSeries,
      //   azmSeries,
      //   breathingSeries,
      //   hrvJson,
      //   dailyJson,
      //   caloriesJson,
      //   exerciseJson,
      //   sleepJson,
      //   rhr7dJson,
      //   steps7dJson,
      //   spo2Daily,
      //   tempSkinDaily,
      //   nutritionDaily,
      //   waterDaily,
      //   hrvIntraday,
      // });

      // Client-provided features
      let clientFeats = {};
      if (req.clientFeatures) {
        try {
          clientFeats = JSON.parse(req.clientFeatures);
        } catch {
          clientFeats = {};
        }
      }
      const { lat, lon, anchorMs, ...restClientFeats } = clientFeats;

      const tz =
        typeof lat === "number" && typeof lon === "number"
          ? tzLookup(lat, lon)
          : "UTC";

      const base =
        typeof anchorMs === "number" && Number.isFinite(anchorMs)
          ? dayjs(anchorMs)
          : dayjs();

      const anchor = base.tz(tz);
      // Fitbit-derived features for this anchor time
      const fitbitFeats = await buildAllFeatures({
        stepsSeries,
        azmSeries,
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
      console.log("heart", heartSeries);
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
