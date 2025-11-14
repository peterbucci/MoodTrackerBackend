import dayjs from "dayjs";
import {
  featuresFromSteps,
  sedentaryMinsLast3hFromSteps,
  azmSpike30mFromSteps,
} from "./stepsFeatures.js";
import { featuresFromDailySummary } from "./dailyFeatures.js";
import { caloriesOutLast3hFromIntraday } from "./calorieFeatures.js";
import {
  timeSinceLastExerciseMinFromList,
  postExerciseWindow90mFromList,
} from "./exerciseFeatures.js";
import { featuresFromSleepRange } from "./sleepFeatures.js";
import { restingHr7dTrendFromSeries } from "./restingHrFeatures.js";
import { featuresFromHeartIntraday } from "./hrFeatures.js";

/**
 * Simple composite acute index with correct directions:
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
  heartSeries, // NEW: from fetchHeartIntraday()
  dailyJson, // from fetchDailySummary()
  caloriesJson, // from fetchCaloriesIntraday()
  exerciseJson, // from fetchMostRecentExercise()
  sleepJson, // from fetchSleepRange()
  rhr7dJson, // from fetchRestingHr7d()
  dateISO, // YYYY-MM-DD (for intraday alignment)
  now = dayjs(),
}) {
  // --- Tier A + Tier 1 ---

  // Step-derived
  const stepFeats = featuresFromSteps(stepsSeries, now);
  const sedentaryMinsLast3h = sedentaryMinsLast3hFromSteps(stepsSeries, now);
  const azmSpike30m = azmSpike30mFromSteps(stepsSeries, now);

  // HR acute features
  const hrFeats = featuresFromHeartIntraday(heartSeries, rhr7dJson, now);

  // Daily summary-derived
  const dailyFeats = featuresFromDailySummary(dailyJson, now);

  // Intraday calories 3h
  const caloriesOutLast3h = caloriesOutLast3hFromIntraday(
    caloriesJson,
    dateISO,
    now
  );

  // Time since last exercise + 90m post-ex window
  const timeSinceLastExerciseMin = timeSinceLastExerciseMinFromList(
    exerciseJson,
    now
  );
  const postExerciseWindow90m = postExerciseWindow90mFromList(
    exerciseJson,
    now
  );
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

  return {
    // Acute + Tier 1
    ...stepFeats,
    azmToday: dailyFeats.azmToday,
    timeSinceLastExerciseMin,
    sedentaryMinsLast3h,
    caloriesOutLast3h,
    caloriesOutToday: dailyFeats.caloriesOutToday,
    restingHR: dailyFeats.restingHR,
    hourOfDay: dailyFeats.hourOfDay,
    dayOfWeek: dailyFeats.dayOfWeek,
    isWeekend: dailyFeats.isWeekend,

    // Tier A HR + AZM
    hrAvgLast5m: hrFeats.hrAvgLast5m,
    hrAvgLast15m: hrFeats.hrAvgLast15m,
    hrDelta5m: hrFeats.hrDelta5m,
    hrDelta15m: hrFeats.hrDelta15m,
    hrZNow: hrFeats.hrZNow,
    postExerciseWindow90m,
    azmSpike30m,
    acuteArousalIndex,

    // Tier 2: sleep + trends
    sleepDurationLastNightHrs: sleepFeats.sleepDurationLastNightHrs,
    sleepEfficiency: sleepFeats.sleepEfficiency,
    wasoMinutes: sleepFeats.wasoMinutes,
    remRatio: sleepFeats.remRatio,
    deepRatio: sleepFeats.deepRatio,
    bedtimeStdDev7d: sleepFeats.bedtimeStdDev7d,
    restingHR7dTrend,
    notes: sleepFeats.notes, // array of strings
  };
}
