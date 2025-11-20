import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

export interface ExerciseSummary {
  logId?: string | number | null;
  activityName?: string | null;
  startTime?: string | null; // ISO string from Fitbit
  durationMs?: number | null; // duration or activeDuration in ms
  steps?: number | null;
  calories?: number | null;
  averageHeartRate?: number | null;
  azmTotal?: number | null;
  azmFatBurn?: number | null;
  azmCardio?: number | null;
  azmPeak?: number | null;
}

/* ---------------------------------------------
   1. TIME-SINCE + POST-EXERCISE WINDOW
--------------------------------------------- */

/**
 * Compute time since last exercise in minutes.
 */
export function timeSinceLastExerciseMinFromList(
  listJson: any,
  now: Dayjs = dayjs()
) {
  const last = listJson?.activities?.[0];
  if (!last) return null;
  const end = dayjs(last.startTime).add(
    last.duration || last.activeDuration || 0,
    "millisecond"
  );
  return Math.max(0, now.diff(end, "minute"));
}

/**
 * Boolean “within 90 minutes after exercise?”
 */
export function postExerciseWindow90mFromList(
  listJson: any,
  now: Dayjs = dayjs()
) {
  const mins = timeSinceLastExerciseMinFromList(listJson, now);
  if (mins == null) return null;
  return mins <= 90;
}

/* ---------------------------------------------
   2. NORMALIZATION OF MOST-RECENT EXERCISE
--------------------------------------------- */

export function normalizeMostRecentExercise(raw: any): ExerciseSummary | null {
  const activities = Array.isArray(raw?.activities) ? raw.activities : [];
  const a = activities[0];
  if (!a) return null;

  const azm = a.activeZoneMinutes || {};
  const zones = Array.isArray(azm.minutesInHeartRateZones)
    ? azm.minutesInHeartRateZones
    : [];

  let fatBurn: number | null = null;
  let cardio: number | null = null;
  let peak: number | null = null;

  for (const z of zones) {
    const name = String(z.name || z.zoneName || "").toLowerCase();
    const minutes =
      typeof z.minutes === "number" && Number.isFinite(z.minutes)
        ? z.minutes
        : 0;

    if (!minutes) continue;

    if (name.includes("fat") || name.includes("burn")) {
      fatBurn = (fatBurn ?? 0) + minutes;
    } else if (name.includes("cardio")) {
      cardio = (cardio ?? 0) + minutes;
    } else if (name.includes("peak")) {
      peak = (peak ?? 0) + minutes;
    }
  }

  return {
    logId: a.logId ?? null,
    activityName: a.activityName ?? null,
    startTime: a.startTime ?? null,
    durationMs:
      typeof a.duration === "number"
        ? a.duration
        : typeof a.activeDuration === "number"
        ? a.activeDuration
        : null,
    steps:
      typeof a.steps === "number" && Number.isFinite(a.steps) ? a.steps : null,
    calories:
      typeof a.calories === "number" && Number.isFinite(a.calories)
        ? a.calories
        : null,
    averageHeartRate:
      typeof a.averageHeartRate === "number" &&
      Number.isFinite(a.averageHeartRate)
        ? a.averageHeartRate
        : null,
    azmTotal:
      typeof azm.totalMinutes === "number" && Number.isFinite(azm.totalMinutes)
        ? azm.totalMinutes
        : null,
    azmFatBurn: fatBurn,
    azmCardio: cardio,
    azmPeak: peak,
  };
}

/* ---------------------------------------------
   3. LAST-EXERCISE DERIVED FEATURES
--------------------------------------------- */

export function featuresFromExercise(ex: ExerciseSummary | null | undefined) {
  if (!ex) {
    return {
      lastExerciseType: null,
      lastExerciseStartTime: null,
      lastExerciseDurationMinutes: null,
      lastExerciseSteps: null,
      lastExerciseCalories: null,
      lastExerciseAvgHr: null,
      lastExerciseAzmTotal: null,
      lastExerciseAzmFatBurn: null,
      lastExerciseAzmCardio: null,
      lastExerciseAzmPeak: null,
    };
  }

  return {
    lastExerciseType: ex.activityName ?? null,
    lastExerciseStartTime: ex.startTime ?? null,
    lastExerciseDurationMinutes:
      typeof ex.durationMs === "number" ? ex.durationMs / 60000 : null,
    lastExerciseSteps:
      typeof ex.steps === "number" && Number.isFinite(ex.steps)
        ? ex.steps
        : null,
    lastExerciseCalories:
      typeof ex.calories === "number" && Number.isFinite(ex.calories)
        ? ex.calories
        : null,
    lastExerciseAvgHr:
      typeof ex.averageHeartRate === "number" &&
      Number.isFinite(ex.averageHeartRate)
        ? ex.averageHeartRate
        : null,
    lastExerciseAzmTotal:
      typeof ex.azmTotal === "number" && Number.isFinite(ex.azmTotal)
        ? ex.azmTotal
        : null,
    lastExerciseAzmFatBurn:
      typeof ex.azmFatBurn === "number" && Number.isFinite(ex.azmFatBurn)
        ? ex.azmFatBurn
        : null,
    lastExerciseAzmCardio:
      typeof ex.azmCardio === "number" && Number.isFinite(ex.azmCardio)
        ? ex.azmCardio
        : null,
    lastExerciseAzmPeak:
      typeof ex.azmPeak === "number" && Number.isFinite(ex.azmPeak)
        ? ex.azmPeak
        : null,
  };
}

/* ---------------------------------------------
   4. FINAL EXERCISE FEATURE GROUP
--------------------------------------------- */

/**
 * This merges:
 * - timeSinceLastExerciseMin
 * - postExerciseWindow90m
 * - all lastExercise* features
 *
 * Pass:
 *   - listJson       = output of /activities/list
 *   - recentJson     = output of fetchMostRecentExercise
 *   - now            = optional dayjs() override
 */
export function buildExerciseFeatureBlock(
  exerciseJson: any,
  now: Dayjs = dayjs()
) {
  const exerciseSummary = normalizeMostRecentExercise(exerciseJson);

  return {
    timeSinceLastExerciseMin: timeSinceLastExerciseMinFromList(
      exerciseJson,
      now
    ),
    postExerciseWindow90m: postExerciseWindow90mFromList(exerciseJson, now),
    ...featuresFromExercise(exerciseSummary),
  };
}
