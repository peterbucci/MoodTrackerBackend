import dayjs from "dayjs";
import {
  featuresFromSteps,
  sedentaryMinsLast3hFromSteps,
} from "./stepsFeatures.js";
import { featuresFromDailySummary } from "./dailyFeatures.js";
import { caloriesOutLast3hFromIntraday } from "./calorieFeatures.js";
import { timeSinceLastExerciseMinFromList } from "./exerciseFeatures.js";
import { featuresFromSleepRange } from "./sleepFeatures.js";
import { restingHr7dTrendFromSeries } from "./restingHrFeatures.js";

/**
 * Pure combiner: NO network calls here.
 * Accept pre-fetched Fitbit JSON + steps series and compute features
 * anchored to `now` (the request time).
 */
export async function buildAllFeatures({
  stepsSeries,
  dailyJson, // from fetchDailySummary()
  caloriesJson, // from fetchCaloriesIntraday()
  exerciseJson, // from fetchMostRecentExercise()
  sleepJson, // from fetchSleepRange()
  rhr7dJson, // from fetchRestingHr7d()
  dateISO, // YYYY-MM-DD (for intraday alignment)
  now = dayjs(),
}) {
  // --- Tier A + Tier 1 ---

  // Step-derived (already implemented)
  const stepFeats = featuresFromSteps(stepsSeries, now);
  const sedentaryMinsLast3h = sedentaryMinsLast3hFromSteps(stepsSeries, now);

  // Daily summary-derived
  const dailyFeats = featuresFromDailySummary(dailyJson, now);

  // Intraday calories 3h
  const caloriesOutLast3h = caloriesOutLast3hFromIntraday(
    caloriesJson,
    dateISO,
    now
  );

  // Time since last exercise
  const timeSinceLastExerciseMin = timeSinceLastExerciseMinFromList(
    exerciseJson,
    now
  );

  // --- Tier 2: Sleep & Short-Term Trends ---

  const sleepFeats = featuresFromSleepRange(sleepJson, now);
  const restingHR7dTrend = restingHr7dTrendFromSeries(rhr7dJson);
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
