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
  fetchHrvRange,
} from "../services/fitbit/heart.ts";
import {
  fetchSleepRange,
  fetchBreathingRateIntraday,
  fetchBreathingRateRange,
} from "../services/fitbit/sleep.ts";
import {
  fetchSpo2Daily,
  fetchSpo2Range,
  fetchTempSkinDaily,
  fetchTempSkinRange,
} from "../services/fitbit/health.ts";
import {
  fetchNutritionDaily,
  fetchWaterDaily,
} from "../services/fitbit/nutrition.ts";
import { getAccessToken } from "../services/fitbit/oauth.js";
import { insertFeature } from "../db/queries/features.js";
import { insertLabel, linkFeatureLabel } from "../db/queries/labels.js";
import {
  insertFeatureDesktop,
  insertLabelDesktop,
  linkFeatureLabelDesktop,
  upsertFeatureContextDesktop,
} from "../db/queries/desktop.js";
import { desktopDb } from "../db/index.js";
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
import { config } from "../config/index.js";

// Helper: persist label if request has one
function maybeSaveLabelForFeature({ req, userId, featureId, nowTs }) {
  if (!req.label || typeof req.label !== "string" || !req.label.trim()) {
    return null;
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

  return labelId;
}

// Dual-write the simplified feature, label, and context to the desktop DB.
const writeDesktopRecord = desktopDb.transaction(
  ({
    featureId,
    userId,
    createdAt,
    source,
    labelId,
    label,
    labelCategory,
    context,
  }) => {
    insertFeatureDesktop.run({
      id: featureId,
      user_id: userId,
      created_at: new Date(createdAt).toISOString(),
      source,
    });

    if (label && labelId) {
      insertLabelDesktop.run({
        id: labelId,
        user_id: userId,
        label,
        category: labelCategory || null,
        created_at: new Date(createdAt).toISOString(),
      });

      linkFeatureLabelDesktop.run({
        feature_id: featureId,
        label_id: labelId,
      });
    }

    upsertFeatureContextDesktop.run({
      feature_id: featureId,
      calendarBusyNow: context.calendarBusyNow ?? null,
      lastCalendarEventType: context.lastCalendarEventType ?? null,
      notificationBurst5m: context.notificationBurst5m ?? null,
      notificationCount60m: context.notificationCount60m ?? null,
      daylightNowFlag: context.daylightNowFlag ?? null,
      daylightMinsRemaining: context.daylightMinsRemaining ?? null,
      weatherTempF: context.weatherTempF ?? null,
      weatherFeelsLikeF: context.weatherFeelsLikeF ?? null,
      weatherPrecipMm: context.weatherPrecipMm ?? null,
      outdoorAQI: context.outdoorAQI ?? null,
      lat: context.lat ?? null,
      lon: context.lon ?? null,
    });
  }
);

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
  // BUT keep each request's own anchor + lat/lon
  // -------------------------------
  const groups = new Map();

  for (const r of pending) {
    let clientFeats = {};

    try {
      clientFeats = JSON.parse(r.clientFeatures) || {};
    } catch {
      clientFeats = {};
    }

    const { lat, lon, anchorMs } = clientFeats;

    const tz =
      typeof lat === "number" && typeof lon === "number"
        ? tzLookup(lat, lon)
        : "UTC";

    // Always prefer the request timestamp the server already knows
    const base =
      typeof r.createdAt === "number" ? dayjs(r.createdAt) : dayjs(anchorMs); // fallback to client anchor if provided

    const anchor = base.tz(tz);
    const dateStr = anchor.format("YYYY-MM-DD");

    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr).push({ req: r, anchor, lat, lon });
  }

  const accessToken = await getAccessToken(userId);
  let total = 0;

  // -------------------------------
  // For each date, fetch Fitbit data once, then per-request processing
  // -------------------------------
  for (const [dateStr, requestGroup] of groups.entries()) {
    const start = dayjs(dateStr).subtract(6, "day").format("YYYY-MM-DD");
    const end = dateStr;

    const [
      stepsSeries,
      heartSeries,
      azmSeries,
      breathingSeries,
      breathingRangeJson,

      // HRV
      hrvDailyJson,
      hrvIntradaySeries,
      hrvRangeJson,

      // daily + intraday
      dailyJson,
      caloriesJson,
      sleepJson,
      rhr7dJson,
      steps7dJson,

      // health
      spo2Daily,
      spo2History,
      tempSkinDaily,
      tempSkinHistory,

      // nutrition/hydration
      nutritionDaily,
      waterDaily,
    ] = await Promise.all([
      fetchStepsIntraday(accessToken, dateStr),
      fetchHeartIntraday(accessToken, dateStr),
      fetchAzmIntraday(accessToken, dateStr),
      fetchBreathingRateIntraday(accessToken, dateStr),
      fetchBreathingRateRange(accessToken, start, end),

      // HRV
      fetchHrvDaily(accessToken, dateStr),
      fetchHrvIntraday(accessToken, dateStr),
      fetchHrvRange(accessToken, start, end),

      // Daily summary + intraday calories + workout
      fetchDailySummary(accessToken, dateStr),
      fetchCaloriesIntraday(accessToken, dateStr),

      // Sleep
      fetchSleepRange(accessToken, dateStr, 7),
      fetchRestingHr7d(accessToken, dateStr),
      fetchSteps7d(accessToken, dateStr),

      // health
      fetchSpo2Daily(accessToken, dateStr),
      fetchSpo2Range(accessToken, start, end),
      fetchTempSkinDaily(accessToken, dateStr),
      fetchTempSkinRange(accessToken, start, end),

      // nutrition
      fetchNutritionDaily(accessToken, dateStr),
      fetchWaterDaily(accessToken, dateStr),
    ]);

    for (const { req, anchor, lat, lon } of requestGroup) {
      let clientFeats = {};
      if (req.clientFeatures) {
        try {
          clientFeats = JSON.parse(req.clientFeatures);
        } catch {
          clientFeats = {};
        }
      }

      // strip off fields we already handled (lat/lon/anchorMs)
      const {
        lat: _lat,
        lon: _lon,
        anchorMs,
        ...restClientFeats
      } = clientFeats;

      // Per-request exercise fetch using full timestamp
      const exerciseJson = await fetchMostRecentExercise(
        accessToken,
        anchor.format("YYYY-MM-DDTHH:mm:ss.SSS")
      );

      // Build all Fitbit-derived features with per-request anchor
      const fitbitFeats = await buildAllFeatures({
        stepsSeries,
        azmSeries,
        heartSeries,
        breathingSeries,
        breathingRangeJson,
        dailyJson,
        caloriesJson,
        exerciseJson,
        sleepJson,
        rhr7dJson,
        steps7dJson,

        hrvDailyJson,
        hrvRangeJson,
        hrvIntradaySeries,

        spo2Daily,
        spo2History,
        tempSkinDaily,
        tempSkinHistory,
        nutritionDaily,
        waterDaily,

        now: anchor,
      });

      const geoTimeFeats = await buildGeoAndTimeFeatures({
        lat,
        lon,
        anchor,
      });

      const mergedFeats = {
        ...fitbitFeats,
        ...restClientFeats,
        ...geoTimeFeats,
      };

      const featureId = uuidv4();
      const createdAtTs =
        typeof req.createdAt === "number" && Number.isFinite(req.createdAt)
          ? req.createdAt
          : Date.now();

      insertFeature.run({
        id: featureId,
        userId,
        createdAt: createdAtTs,
        source: "phone-request",
        data: JSON.stringify(mergedFeats),
      });

      const labelId = maybeSaveLabelForFeature({
        req,
        userId,
        featureId,
        nowTs: createdAtTs,
      });

      if (config.DUAL_WRITE_DESKTOP !== false) {
        try {
          writeDesktopRecord({
            featureId,
            userId,
            createdAt: createdAtTs,
            source: "phone-request",
            labelId,
            label: req.label,
            labelCategory: req.labelCategory,
            context: {
              calendarBusyNow: restClientFeats.calendarBusyNow,
              lastCalendarEventType: restClientFeats.lastCalendarEventType,
              notificationBurst5m: restClientFeats.notificationBurst5m,
              notificationCount60m: restClientFeats.notificationCount60m,
              daylightNowFlag: geoTimeFeats.daylightNowFlag,
              daylightMinsRemaining: geoTimeFeats.daylightMinsRemaining,
              weatherTempF: geoTimeFeats.weatherTempF,
              weatherFeelsLikeF: geoTimeFeats.weatherFeelsLikeF,
              weatherPrecipMm: geoTimeFeats.weatherPrecipMm,
              outdoorAQI: geoTimeFeats.outdoorAQI,
              lat,
              lon,
            },
          });
        } catch (err) {
          console.warn("desktop dual-write failed", err);
        }
      }

      fulfillOneRequest.run({ requestId: req.id, featureId });
      total += 1;
    }
  }

  return { ok: true, didFetch: true, requestsFulfilled: total };
}
