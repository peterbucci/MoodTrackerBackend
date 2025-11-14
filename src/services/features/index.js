import dayjs from "dayjs";
import {
  featuresFromSteps,
  sedentaryMinsLast3hFromSteps,
} from "./stepsFeatures.js";
import { featuresFromDailySummary } from "./dailyFeatures.js";
import { caloriesOutLast3hFromIntraday } from "./calorieFeatures.js";
import { timeSinceLastExerciseMinFromList } from "./exerciseFeatures.js";

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
  dateISO, // YYYY-MM-DD (for intraday alignment)
  now = dayjs(),
}) {
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

  return {
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
  };
}
