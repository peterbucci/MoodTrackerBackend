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

type PendingCountRow = { c: number };
type PendingRequestRow = {
  id: string;
  userId: string;
  createdAt: number;
  clientFeatures: string | null;
  label?: string | null;
  labelCategory?: string | null;
};

// Helper: persist label if request has one
function maybeSaveLabelForFeature({
  req,
  userId,
  featureId,
  nowTs,
}: {
  req: any;
  userId: string;
  featureId: string;
  nowTs: number;
}): string | null {
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

// Dual-write to desktop DB (transactional, best-effort from caller)
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
  }: {
    featureId: string;
    userId: string;
    createdAt: number;
    source: string;
    labelId: string | null;
    label: string | null;
    labelCategory: string | null;
    context: any;
  }) => {
    const createdIso = new Date(createdAt).toISOString();

    insertFeatureDesktop.run({
      id: featureId,
      user_id: userId,
      created_at: createdIso,
      source,
    });

    if (label && labelId) {
      insertLabelDesktop.run({
        id: labelId,
        user_id: userId,
        label,
        category: labelCategory || null,
        created_at: createdIso,
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

export async function tryFulfillPending(userId: string) {
  // Fetch all pending detailed requests for this user. If none, exit early.
  const pending = listPendingDetailed.all(userId) as PendingRequestRow[];
  if (!pending?.length) {
    return { ok: true, didFetch: false, reason: "no-pending" };
  }

  // -------------------------------
  // Group requests by DATE in user's timezone but keep each request's own lat/lon
  // -------------------------------
  const groups = new Map<
    string,
    Array<{
      req: any;
      anchor: dayjs.Dayjs;
      lat?: number;
      lon?: number;
      createdAt: number;
    }>
  >();

  for (const r of pending) {
    let clientFeats: any = {};

    try {
      const rawClientFeatures = r.clientFeatures ?? "{}";
      clientFeats = rawClientFeatures ? JSON.parse(rawClientFeatures) : {};
    } catch {
      clientFeats = {};
    }

    const { lat, lon } = clientFeats;

    const createdAtTs = r.createdAt;
    if (typeof createdAtTs !== "number" || !Number.isFinite(createdAtTs)) {
      return {
        ok: false,
        didFetch: false,
        reason: "invalid-createdAt",
        requestId: r.id,
      };
    }

    const tz =
      typeof lat === "number" && typeof lon === "number"
        ? tzLookup(lat, lon)
        : "UTC";

    const anchor = dayjs(createdAtTs).tz(tz);
    const dateStr = anchor.format("YYYY-MM-DD");

    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups
      .get(dateStr)!
      .push({ req: r, anchor, lat, lon, createdAt: createdAtTs });
  }

  const accessToken = await getAccessToken(userId);
  let total = 0;

  // -------------------------------
  // For each date, fetch Fitbit data once
  // Then, for each request in that date, use its own anchor
  // -------------------------------
  for (const [dateStr, requestGroup] of groups.entries()) {
    // Pick a representative anchor from this group to decide "night" date
    const sampleAnchor = requestGroup[0].anchor;

    // If anchor is in early morning (< 12:00), treat last night as previous calendar day
    const nightAnchor =
      sampleAnchor.hour() < 12 ? sampleAnchor.subtract(1, "day") : sampleAnchor;

    const nightDateStr = nightAnchor.format("YYYY-MM-DD");
    const nightStart = nightAnchor.subtract(6, "day").format("YYYY-MM-DD");

    const [
      stepsSeries,
      heartSeries,
      azmSeries,

      // Breathing
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
      // Activity: keyed to "day" date
      fetchStepsIntraday(accessToken, dateStr),
      fetchHeartIntraday(accessToken, dateStr),
      fetchAzmIntraday(accessToken, dateStr),

      // Breathing: keyed to "night" date / window
      fetchBreathingRateIntraday(accessToken, nightDateStr),
      fetchBreathingRateRange(accessToken, nightStart, nightDateStr),

      // HRV: nightly/intraday keyed to "night" date / window
      fetchHrvDaily(accessToken, nightDateStr),
      fetchHrvIntraday(accessToken, nightDateStr),
      fetchHrvRange(accessToken, nightStart, nightDateStr),

      // Daily summary + intraday calories + workout (day-aligned)
      fetchDailySummary(accessToken, dateStr),
      fetchCaloriesIntraday(accessToken, dateStr),

      // Sleep (7-day range ending on the "day" dateStr)
      fetchSleepRange(accessToken, dateStr, 7),
      fetchRestingHr7d(accessToken, dateStr),
      fetchSteps7d(accessToken, dateStr),

      // Health nightly metrics: keyed to "night" date / window
      fetchSpo2Daily(accessToken, nightDateStr),
      fetchSpo2Range(accessToken, nightStart, nightDateStr),
      fetchTempSkinDaily(accessToken, nightDateStr),
      fetchTempSkinRange(accessToken, nightStart, nightDateStr),

      // nutrition (day-aligned)
      fetchNutritionDaily(accessToken, dateStr),
      fetchWaterDaily(accessToken, dateStr),
    ]);

    for (const { req, anchor, lat, lon, createdAt } of requestGroup) {
      let clientFeats: any = {};
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
        anchorMs: _anchorMs,
        ...restClientFeats
      } = clientFeats;

      // Per-request exercise fetch using full timestamp
      const exerciseJson = await fetchMostRecentExercise(
        accessToken,
        anchor.format("YYYY-MM-DDTHH:mm:ss.SSS") // no Z, fits Fitbit's pattern
      );

      // Build all Fitbit-derived features with *per-request* anchor
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

        now: anchor, // per-request timestamp
      });

      const geoTimeFeats: Record<string, any> = await buildGeoAndTimeFeatures({
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
      const createdAtTs = createdAt;

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
