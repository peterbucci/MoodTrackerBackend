/**
 * Generic feature map type – keep it loose so it works with your existing blob.
 */
export type FeatureMap = Record<string, any>;

/* ---------------------------------------------
   Small helpers
--------------------------------------------- */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  return null;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function inRange(x: number | null, lo: number, hi: number): boolean {
  if (x == null) return false;
  return x >= lo && x <= hi;
}

/* ---------------------------------------------
   1. Overexertion
   - "Too much output, not enough recovery"
--------------------------------------------- */

function computeOverexertionFlag(f: FeatureMap): boolean | null {
  const lowSleepHighActivityFlag = bool(f.lowSleepHighActivityFlagFeature);

  const sleepDurationHrs = num(f.sleepDurationLastNightHrs);
  const sleepDebtHrs = num(f.sleepDebtHrs);
  const azmToday = num(f.azmToday); // daily AZM summary

  // hoursSinceLastExercise may or may not exist separately;
  // fall back to timeSinceLastExerciseMin if needed.
  const hoursSinceLastExercise =
    num(f.hoursSinceLastExercise) ??
    (num(f.timeSinceLastExerciseMin) != null
      ? num(f.timeSinceLastExerciseMin)! / 60
      : null);

  const lastExerciseDurationMinutes = num(f.lastExerciseDurationMinutes);

  const shortSleep = sleepDurationHrs != null && sleepDurationHrs < 6;
  const highSleepDebt = sleepDebtHrs != null && sleepDebtHrs >= 2;
  const highAzmToday = azmToday != null && azmToday >= 60; // 60+ AZM ≈ fairly active day

  const recentLongExercise =
    lastExerciseDurationMinutes != null &&
    lastExerciseDurationMinutes >= 45 &&
    hoursSinceLastExercise != null &&
    hoursSinceLastExercise <= 8;

  // If we have the explicit cross-feature, trust it
  if (lowSleepHighActivityFlag != null && lowSleepHighActivityFlag) {
    return true;
  }

  // Fallback logic using primitives
  if ((shortSleep || highSleepDebt) && highAzmToday) {
    return true;
  }
  if (recentLongExercise && highAzmToday) {
    return true;
  }

  // If we have enough data to decide it's clearly *not* overexertion:
  if (
    sleepDurationHrs != null ||
    sleepDebtHrs != null ||
    azmToday != null ||
    lastExerciseDurationMinutes != null
  ) {
    return false;
  }

  return null;
}

/* ---------------------------------------------
   2. Stress Spike
   - Acute arousal not explained by very recent exercise
--------------------------------------------- */

function computeStressSpikeFlag(f: FeatureMap): boolean | null {
  const hrZNow = num(f.hrZNow);
  const hrZLast15m = num(f.hrZLast15m);
  const hrDelta5m = num(f.hrDelta5m);
  const hrDelta15m = num(f.hrDelta15m);
  const hrSlopeLast30m = num(f.hrSlopeLast30m);
  const postExerciseWindow90m = bool(f.postExerciseWindow90m);

  const z = hrZLast15m != null ? hrZLast15m : hrZNow;
  if (z == null) return null;

  const highHr = z >= 1.0; // 1+ SD above baseline
  const sharpJump =
    (hrDelta5m != null && hrDelta5m >= 10) ||
    (hrDelta15m != null && hrDelta15m >= 15) ||
    (hrSlopeLast30m != null && hrSlopeLast30m >= 0.3);

  // Ignore HR spikes in the immediate post-exercise window – that's normal
  const inPostExerciseWindow = postExerciseWindow90m === true;

  if (!highHr || !sharpJump) {
    // We had enough HR info to say "no"
    return false;
  }

  if (inPostExerciseWindow) {
    return false;
  }

  return true;
}

/* ---------------------------------------------
   3. Evening Restlessness Score (0–1)
   - Lots of movement / AZM / elevated HR in evening
--------------------------------------------- */

function computeEveningRestlessnessScore(f: FeatureMap): number | null {
  const hour = num(f.hourOfDay);
  if (hour == null) return null;

  // Evening window: roughly 6pm–11pm
  const isEvening = hour >= 18 && hour <= 23;
  if (!isEvening) return 0;

  const steps60 = num(f.stepsLast60m);
  const azm60 = num(f.azmLast60m ?? f.azmLast30m);
  const hrZ = num(f.hrZNow ?? f.hrZLast15m);

  const movementScore = steps60 != null ? clamp01(steps60 / 1000) : 0;
  const azmScore = azm60 != null ? clamp01(azm60 / 20) : 0; // 20 AZM in last hour is high
  const hrScore =
    hrZ != null
      ? clamp01((hrZ + 1) / 3) // z=0 → ~0.33, z=2 → ~1
      : 0;

  const score = 0.4 * movementScore + 0.3 * azmScore + 0.3 * hrScore;

  return clamp01(score);
}

/* ---------------------------------------------
   4. Morning Lethargy Score (0–1)
   - Low movement in the morning + high sleep debt
--------------------------------------------- */

function computeMorningLethargyScore(f: FeatureMap): number | null {
  const hour = num(f.hourOfDay);
  if (hour == null) return null;

  // Morning window: roughly 6am–11am
  const isMorning = hour >= 6 && hour <= 11;
  if (!isMorning) return 0;

  const steps60 = num(f.stepsLast60m);
  const sleepDebtHrs = num(f.sleepDebtHrs);
  const hrZ = num(f.hrZNow ?? f.hrZLast15m);

  const sleepDebtScore = sleepDebtHrs != null ? clamp01(sleepDebtHrs / 3) : 0; // 3+ hours debt → saturate

  // High when steps are LOW (invert)
  const inactivityScore = steps60 != null ? clamp01((200 - steps60) / 200) : 0; // 0 steps →1, ≥200 →0

  // Slight boost if HR is below baseline (sluggish)
  const lowHrScore = hrZ != null && hrZ < 0 ? clamp01(-hrZ / 2) : 0; // z=-2 →1

  const score = 0.5 * sleepDebtScore + 0.3 * inactivityScore + 0.2 * lowHrScore;

  return clamp01(score);
}

/* ---------------------------------------------
   5. Doomscrolling Score (0–1)
   - Very sedentary, low steps, late night, often snack-heavy
--------------------------------------------- */

function computeDoomscrollingScore(f: FeatureMap): number | null {
  const hour = num(f.hourOfDay);
  if (hour == null) return null;

  // Late night: 10pm–2am (wrap around midnight)
  const isLateNight = hour >= 22 || hour <= 2;
  if (!isLateNight) return 0;

  const sedentaryMins3h = num(f.sedentaryMinsLast3h);
  const steps30 = num(f.stepsLast30m ?? f.stepsLast60m);
  const snackFraction = num(f.snackCaloriesFraction);

  const sedScore = sedentaryMins3h != null ? clamp01(sedentaryMins3h / 180) : 0; // 180 min sedentary = 3h window

  const lowStepsScore = steps30 != null ? clamp01((100 - steps30) / 100) : 0; // 0 steps →1, ≥100 →0

  const snackScore = snackFraction != null ? clamp01(snackFraction) : 0;

  const score = 0.5 * sedScore + 0.3 * lowStepsScore + 0.2 * snackScore;

  return clamp01(score);
}

/* ---------------------------------------------
   Public builder
--------------------------------------------- */

export function buildCompositePsychophysFeatures(features: FeatureMap) {
  const overexertionFlag = computeOverexertionFlag(features);
  const stressSpikeFlag = computeStressSpikeFlag(features);
  const eveningRestlessnessScore = computeEveningRestlessnessScore(features);
  const morningLethargyScore = computeMorningLethargyScore(features);
  const doomscrollingScore = computeDoomscrollingScore(features);

  return {
    overexertionFlag,
    stressSpikeFlag,
    eveningRestlessnessScore,
    morningLethargyScore,
    doomscrollingScore,
  };
}
