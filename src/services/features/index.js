import dayjs from "dayjs";
import {
  featuresFromSteps,
  sedentaryMinsLast3hFromSteps,
} from "./stepsFeatures.js";
import { featuresFromDailySummary } from "./dailyFeatures.js";
import { caloriesOutLast3hFromIntraday } from "./calorieFeatures.js";
import { featuresFromSleepRange } from "./sleepFeatures.ts";
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
import { buildNutritionFeatureBlock } from "./nutritionFeatures.ts";
import { buildCompositePsychophysFeatures } from "./compositeFeatures.ts";

/**
 * Acute Arousal Index (0 → 10 scale)
 * Measures immediate sympathetic activation.
 *
 * Components:
 *   + HR reactivity (ΔHR, HR slope, HR Z)
 *   + Movement bursts (steps + AZM)
 *   - Sedentary inertia before activation
 *   - Suppressed shortly after exercise
 *   - Suppressed if very sleep-deprived
 */
export function computeAcuteArousalIndex({
  hrDelta5m,
  hrSlopeLast30m,
  hrZNow,
  stepBurst5m,
  stepsLast15m,
  zeroStreakMax60m,
  azmSpike30m,
  postExerciseWindow90m,
  sleepDurationLastNightHrs,
}) {
  const hDelta = hrDelta5m ?? 0;
  const hSlope = hrSlopeLast30m ?? 0;
  const hZ = hrZNow ?? 0;

  const sb = stepBurst5m ?? 0;
  const steps15 = stepsLast15m ?? 0;
  const az = azmSpike30m ?? 0;
  const zs = zeroStreakMax60m ?? 0;

  /* -----------------------------------
     HR Reactivity Component (0–4)
  ----------------------------------- */
  const hrComponent =
    1.2 * hDelta + // strong fast HR jumps
    30 * hSlope + // slope is usually tiny, multiply
    1.0 * hZ; // HR Z confirms sympathetic load

  /* -----------------------------------
     Movement Reactivity (0–4)
  ----------------------------------- */
  const movementComponent =
    0.015 * steps15 + // 1000 steps → +15
    0.5 * sb + // short burst detection
    1.0 * az; // strong AZM spike = strong arousal

  /* -----------------------------------
     Sedentary Inertia Penalty (0–2)
     Large sudden bursts after long sitting = higher activation
     Small / no burst after sedentary = lower activation
  ----------------------------------- */
  let sedentaryPenalty = 0;
  if (zs >= 45 && sb < 15 && hDelta < 5) {
    // very sedentary but no real activation = muted system
    sedentaryPenalty = -1.0;
  } else if (zs >= 45 && (sb > 30 || hDelta > 10)) {
    // big break from long sitting = large arousal
    sedentaryPenalty = +1.0;
  }

  /* -----------------------------------
     Context Suppression
  ----------------------------------- */

  // Less meaningful if this is just post-exercise HR decay.
  let exerciseSuppress = 0;
  if (postExerciseWindow90m === true) {
    exerciseSuppress = -1.5;
  }

  // Very sleep-deprived → blunted autonomic reactivity.
  let sleepSuppress = 0;
  if (sleepDurationLastNightHrs != null && sleepDurationLastNightHrs < 6) {
    sleepSuppress = -0.5;
  }

  /* -----------------------------------
     Final Combine
  ----------------------------------- */

  let score =
    hrComponent +
    movementComponent +
    sedentaryPenalty +
    exerciseSuppress +
    sleepSuppress;

  /* -----------------------------------
     Normalize to 0 → 10
  ----------------------------------- */
  if (score < 0) score = 0;
  if (score > 10) score = 10;

  return score;
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
    hrSlopeLast30m: hrFeats.hrSlopeLast30m,
    hrZNow: hrFeats.hrZNow,

    stepBurst5m: stepFeats.stepBurst5m,
    stepsLast15m: stepFeats.stepsLast15m, // if you don’t have this, use 0 or stepsLast30m
    zeroStreakMax60m: stepFeats.zeroStreakMax60m,

    azmSpike30m,
    postExerciseWindow90m: exerciseFeats.postExerciseWindow90m,

    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,
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
    hourOfDay: dailyFeats.hourOfDay,
    isWeekend: dailyFeats.isWeekend,

    stepsLast30m: stepFeats.stepsLast30m,
    stepsLast60m: stepFeats.stepsLast60m,

    azmLast30m: azmFeats.azmLast30m,
    azmLast60m: azmFeats.azmLast60m,

    zeroStreakMax60m: stepFeats.zeroStreakMax60m,
    stepsZToday,

    postExerciseWindow90m: exerciseFeats.postExerciseWindow90m,

    hrZNow: hrFeats.hrZNow,
    hrZLast15m: hrFeats.hrZLast15m,
  });

  const lowSleepHighActivity = lowSleepHighActivityFlagFeature({
    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,
    sleepDebtHrs,
    stepsZToday,
    azmToday: dailyFeats.azmToday,
    lastExerciseDurationMinutes: exerciseFeats.lastExerciseDurationMinutes,
    hoursSinceLastExercise:
      exerciseFeats.timeSinceLastExerciseMin != null
        ? exerciseFeats.timeSinceLastExerciseMin / 60
        : null,
    hrZNow: hrFeats.hrZNow,
  });

  const spo2Feats = featuresFromSpo2(spo2Daily);
  const breathingFeats = featuresFromBreathing(breathingSeries, now);

  const tempSkinFeats = featuresFromTempSkin(tempSkinDaily);
  const nutritionFeats = buildNutritionFeatureBlock(
    nutritionDaily,
    waterDaily,
    now
  );

  const baseFeatures = {
    // Time & context
    hourOfDay: dailyFeats.hourOfDay,

    // Steps
    stepsLast60m: stepFeats.stepsLast60m,
    stepsLast30m: stepFeats.stepsLast30m ?? stepFeats.stepsLast60m,
    sedentaryMinsLast3h,

    // AZM
    azmToday: dailyFeats.azmToday,
    azmLast60m: azmFeats.azmLast60m,
    azmLast30m: azmFeats.azmLast30m,

    // HR
    hrZNow: hrFeats.hrZNow,
    hrZLast15m: hrFeats.hrZLast15m,
    hrDelta5m: hrFeats.hrDelta5m,
    hrDelta15m: hrFeats.hrDelta15m,
    hrSlopeLast30m: hrFeats.hrSlopeLast30m,

    // Exercise timing
    postExerciseWindow90m: exerciseFeats.postExerciseWindow90m,
    lastExerciseDurationMinutes: exerciseFeats.lastExerciseDurationMinutes,
    hoursSinceLastExercise:
      exerciseFeats.timeSinceLastExerciseMin != null
        ? exerciseFeats.timeSinceLastExerciseMin / 60
        : null,

    // Sleep & fatigue
    sleepDebtHrs,
    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,

    // Personal baselines
    stepsZToday,
    lowSleepHighActivityFlagFeature:
      lowSleepHighActivity.lowSleepHighActivityFlag,

    // Nutrition
    snackCaloriesFraction: nutritionFeats.snackCaloriesFraction,
  };

  const compositeFeatures = buildCompositePsychophysFeatures(baseFeatures);

  return {
    // =========================
    // A — Acute movement & load (minutes–hours)
    // =========================
    ...stepFeats, // stepsLast5m, stepsLast30m, stepsLast60m, stepsLast3h, stepBurst5m, zeroStreakMax60m, stepsSlopeLast60m, stepsAccel5to15m
    sedentaryMinsLast3h,

    ...azmFeats,

    // Acute calories / exercise timing
    caloriesOutLast3h,
    ...exerciseFeats,
    ...tempSkinFeats,

    ...hrFeats,

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

    restingHR7dTrend,

    // Personal long-term patterns
    stepsZToday,
    activityInertia,
    sleepDebtHrs,
    recoveryIndex,

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
    ...nutritionFeats,
    ...compositeFeatures,
  };
}
