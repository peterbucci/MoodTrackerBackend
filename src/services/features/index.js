import dayjs from "dayjs";
import {
  featuresFromSteps,
  sedentaryMinsLast3hFromSteps,
} from "./stepsFeatures.js";
import { featuresFromDailySummary } from "./dailyFeatures.js";
import { caloriesOutLast3hFromIntraday } from "./calorieFeatures.js";
import { featuresFromSleepRange } from "./sleepFeatures.js";
import { restingHr7dTrendFromSeries } from "./restingHrFeatures.js";
import { featuresFromHeartIntraday } from "./hrFeatures.js";
import {
  stepsZTodayFromTimeseries,
  activityInertiaFromSteps7d,
  sleepDebtHrsFromSleepRange,
  recoveryIndexFromSignals,
} from "./personalFeatures.js";
import {
  recentActivityXTimeOfDayFeature,
  lowSleepHighActivityFlagFeature,
} from "./crossFeatures.js";
import { featuresFromAzm } from "./azmFeatures.js";
import { featuresFromHrv } from "./hrvFeatures.js";
import { featuresFromSpo2 } from "./spo2Features.ts";
import { featuresFromBreathing } from "./breathingFeatures.ts";
import { buildExerciseFeatureBlock } from "./exerciseFeatures.ts";
import { featuresFromTempSkin } from "./tempFeatures.ts";

/**
 * Simple composite acute index
 * + hrDelta5m, + stepBurst5m, + azmSpike30m, - zeroStreakMax60m
 */
function computeAcuteArousalIndex({
  hrDelta5m,
  stepBurst5m,
  zeroStreakMax60m,
  azmSpike30m,
}) {
  const h = hrDelta5m ?? 0;
  const sb = stepBurst5m ?? 0;
  const zs = zeroStreakMax60m ?? 0;
  const az = azmSpike30m ?? 0;

  // Heuristic weights; can tweak later
  return h + 0.1 * sb - 0.5 * zs + az;
}

/**
 * Pure combiner: NO network calls here.
 * Accept pre-fetched Fitbit JSON + steps series and compute features
 * anchored to `now` (the request time).
 */
export async function buildAllFeatures({
  stepsSeries,
  azmSeries,
  heartSeries, // from fetchHeartIntraday()
  breathingSeries,
  dailyJson, // from fetchDailySummary()
  caloriesJson, // from fetchCaloriesIntraday()
  exerciseJson, // from fetchMostRecentExercise()
  sleepJson, // from fetchSleepRange()
  rhr7dJson, // from fetchRestingHr7d()
  steps7dJson, // from fetchSteps7d() for Tier 4

  hrvDailyJson, // HRV single-day
  hrvRangeJson, // HRV multi-day (e.g., 7d)
  hrvIntradaySeries, // HRV intraday segments

  spo2Daily,
  tempSkinDaily,
  nutritionDaily,
  waterDaily,

  now = dayjs(),
}) {
  // --- Tier 1 & Acute ---

  // Step-derived
  const stepFeats = featuresFromSteps(stepsSeries, now);
  const sedentaryMinsLast3h = sedentaryMinsLast3hFromSteps(stepsSeries, now);

  // AZM-derived
  const azmFeats = featuresFromAzm(azmSeries, now);
  const azmSpike30m = azmFeats.azmSpike30m;

  // HR acute features
  const hrFeats = featuresFromHeartIntraday(heartSeries, rhr7dJson, now);

  // HRV features
  const hrvFeats = featuresFromHrv(
    hrvDailyJson,
    hrvRangeJson,
    hrvIntradaySeries
  );

  // Daily summary-derived
  const dailyFeats = featuresFromDailySummary(dailyJson, now);

  // Intraday calories 3h
  const caloriesOutLast3h = caloriesOutLast3hFromIntraday(caloriesJson, now);

  const exerciseFeats = buildExerciseFeatureBlock(exerciseJson, now);

  // --- Tier 2: Sleep & Short-Term Trends ---
  const sleepFeats = featuresFromSleepRange(sleepJson, now);
  const restingHR7dTrend = restingHr7dTrendFromSeries(rhr7dJson);

  // --- Acute composite ---
  const acuteArousalIndex = computeAcuteArousalIndex({
    hrDelta5m: hrFeats.hrDelta5m,
    stepBurst5m: stepFeats.stepBurst5m,
    zeroStreakMax60m: stepFeats.zeroStreakMax60m,
    azmSpike30m,
  });

  // --- Tier 4: Personal Trends & Baselines ---

  // 1) stepsZToday + activityInertia from 7d steps timeseries
  const stepsZToday = stepsZTodayFromTimeseries(steps7dJson);
  const activityInertia = activityInertiaFromSteps7d(steps7dJson);

  // 2) sleepDebtHrs from 7d sleep range (reuse same blob)
  const sleepDebtHrs = sleepDebtHrsFromSleepRange(sleepJson, now);

  // 3) recoveryIndex from RHR trend + sleep debt
  const recoveryIndex = recoveryIndexFromSignals({
    restingHR7dTrend,
    sleepDebtHrs,
  });

  const recentActivity = recentActivityXTimeOfDayFeature({
    stepsLast60m: stepFeats.stepsLast60m,
    stepsZToday,
    hourOfDay: dailyFeats.hourOfDay,
    isWeekend: dailyFeats.isWeekend,
  });

  const lowSleepHighActivity = lowSleepHighActivityFlagFeature({
    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,
    sleepDebtHrs,
    stepsZToday,
    azmToday: dailyFeats.azmToday,
  });

  const spo2Feats = featuresFromSpo2(spo2Daily);
  const breathingFeats = featuresFromBreathing(breathingSeries, now);

  const tempSkinFeats = featuresFromTempSkin(tempSkinDaily);

  return {
    // =========================
    // A — Acute movement & load (minutes–hours)
    // =========================
    ...stepFeats, // stepsLast5m, stepsLast30m, stepsLast60m, stepsLast3h, stepBurst5m, zeroStreakMax60m, stepsSlopeLast60m, stepsAccel5to15m
    sedentaryMinsLast3h,

    // Real AZM around label
    azmLast30m: azmFeats.azmLast30m,
    azmLast60m: azmFeats.azmLast60m,
    azmIntensityMinutes30m: azmFeats.azmIntensityMinutes30m,
    azmIntensityMinutes60m: azmFeats.azmIntensityMinutes60m,
    azmZeroStreakMax60m: azmFeats.azmZeroStreakMax60m,
    azmSlopeLast60m: azmFeats.azmSlopeLast60m,
    azmSpike30m,

    // Acute calories / exercise timing
    caloriesOutLast3h,
    ...exerciseFeats,
    ...tempSkinFeats,

    // =========================
    // A — Acute HR / ANS state (minutes–hours)
    // =========================
    hrNow: hrFeats.hrNow,
    hrAvgLast5m: hrFeats.hrAvgLast5m,
    hrAvgLast15m: hrFeats.hrAvgLast15m,
    hrAvgLast60m: hrFeats.hrAvgLast60m,

    hrMinLast15m: hrFeats.hrMinLast15m,
    hrMaxLast15m: hrFeats.hrMaxLast15m,

    hrDelta5m: hrFeats.hrDelta5m,
    hrDelta15m: hrFeats.hrDelta15m,

    hrSlopeLast30m: hrFeats.hrSlopeLast30m,
    hrStdLast30m: hrFeats.hrStdLast30m,

    hrZNow: hrFeats.hrZNow,
    hrZLast15m: hrFeats.hrZLast15m,

    // Composite “how revved up am I right now?”
    acuteArousalIndex,

    // =========================
    // S — Sleep & short-term recovery (last night / recent nights)
    // =========================
    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,
    sleepEfficiency: sleepFeats.sleepEfficiency,
    wasoMinutes: sleepFeats.wasoMinutes,
    remRatio: sleepFeats.remRatio,
    deepRatio: sleepFeats.deepRatio,
    bedtimeStdDev7d: sleepFeats.bedtimeStdDev7d,
    // notes is a free-form descriptor array like ["late bedtime", "fragmented"]
    notes: sleepFeats.notes,

    // =========================
    // C — Daily load, baselines & trends (days–weeks)
    // =========================
    // Daily totals / context
    azmToday: dailyFeats.azmToday,
    caloriesOutToday: dailyFeats.caloriesOutToday,
    restingHR: dailyFeats.restingHR,
    hourOfDay: dailyFeats.hourOfDay,
    dayOfWeek: dailyFeats.dayOfWeek,
    isWeekend: dailyFeats.isWeekend,

    // RHR baselines
    rhrMean7d: hrFeats.rhrMean7d,
    rhrStd7d: hrFeats.rhrStd7d,
    restingHR7dTrend,

    // Personal long-term patterns
    stepsZToday,
    activityInertia,
    sleepDebtHrs,
    recoveryIndex,

    // Zone-specific AZM totals (chronic-ish intensity profile)
    azmFatBurnLast30m: azmFeats.azmFatBurnLast30m,
    azmCardioLast30m: azmFeats.azmCardioLast30m,
    azmPeakLast30m: azmFeats.azmPeakLast30m,

    // =========================
    // S / C / H — HRV & autonomic recovery
    // =========================
    hrvRmssdDaily: hrvFeats.hrvRmssdDaily,
    hrvDeepRmssdDaily: hrvFeats.hrvDeepRmssdDaily,
    hrvRmssd7dAvg: hrvFeats.hrvRmssd7dAvg,
    hrvRmssdDeviationFrom7d: hrvFeats.hrvRmssdDeviationFrom7d,
    hrvIntradayRmssdMean: hrvFeats.hrvIntradayRmssdMean,
    hrvIntradayRmssdStdDev: hrvFeats.hrvIntradayRmssdStdDev,
    hrvIntradayLfMean: hrvFeats.hrvIntradayLfMean,
    hrvIntradayHfMean: hrvFeats.hrvIntradayHfMean,
    hrvIntradayLfHfRatioMean: hrvFeats.hrvIntradayLfHfRatioMean,
    hrvIntradayCoverageMean: hrvFeats.hrvIntradayCoverageMean,

    // =========================
    // X — Cross-feature interactions / context
    // =========================
    ...recentActivity,
    ...lowSleepHighActivity,

    ...spo2Feats,
    ...breathingFeats,
  };
}
