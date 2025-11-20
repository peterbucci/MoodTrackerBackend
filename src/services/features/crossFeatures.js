export function recentActivityXTimeOfDayFeature({
  hourOfDay,
  isWeekend,

  stepsLast30m,
  stepsLast60m,
  azmLast30m,
  azmLast60m,

  zeroStreakMax60m,
  stepsZToday,
  postExerciseWindow90m,
  hrZNow,
  hrZLast15m,
}) {
  if (hourOfDay == null) return { recentActivityXTimeOfDay: null };

  // Select fallbacks
  const steps30 = stepsLast30m ?? stepsLast60m;
  const azm = azmLast30m ?? azmLast60m;
  const hrZ = hrZLast15m ?? hrZNow;

  // If still missing → feature is undefined
  if (steps30 == null || azm == null || hrZ == null) {
    return { recentActivityXTimeOfDay: null };
  }

  /* 1. Time-of-day expectations */
  let expectedSteps = 300;
  let expectedAZM = 2;

  if (hourOfDay < 6) {
    expectedSteps = 60;
    expectedAZM = 0.2;
  } else if (hourOfDay < 12) {
    expectedSteps = 400;
    expectedAZM = 3;
  } else if (hourOfDay < 17) {
    expectedSteps = 550;
    expectedAZM = 4;
  } else {
    expectedSteps = 350;
    expectedAZM = 2.5;
  }

  if (isWeekend) {
    expectedSteps *= 1.25;
    expectedAZM *= 1.25;
  }

  /* 2. Deviations */
  const stepDev = (steps30 - expectedSteps) / expectedSteps;
  const azmDev = (azm - expectedAZM) / (expectedAZM + 0.01);

  const hrComponent = hrZ > 0.5 ? 0.3 : hrZ < -0.5 ? -0.2 : 0;

  /* 3. Penalties / boosts */
  let nightPenalty = 0;
  if (hourOfDay < 6 && !postExerciseWindow90m) nightPenalty = -1.0;

  let sedentaryBoost = 0;
  if (zeroStreakMax60m >= 30 && (steps30 > 400 || azm > 4)) {
    sedentaryBoost = 0.5;
  }

  let dayBias = 0;
  if (stepsZToday > 1.5) dayBias = +0.3;
  else if (stepsZToday < -1.0) dayBias = -0.2;

  /* 4. Combine */
  let score =
    0.7 * (stepDev + azmDev) +
    hrComponent +
    sedentaryBoost +
    dayBias +
    nightPenalty;

  if (score > 2) score = 2;
  if (score < -2) score = -2;

  return { recentActivityXTimeOfDay: score };
}

export function lowSleepHighActivityFlagFeature({
  sleepDurationLastNightHrs,
  sleepDebtHrs,
  stepsZToday,
  azmToday,
  lastExerciseDurationMinutes,
  hoursSinceLastExercise,
  hrZNow,
}) {
  if (sleepDurationLastNightHrs == null && sleepDebtHrs == null) {
    return { lowSleepHighActivityFlag: 0 };
  }

  /* ----------------------------------------
     1. Sleep deprivation component
  ---------------------------------------- */
  const shortSleep =
    sleepDurationLastNightHrs != null && sleepDurationLastNightHrs < 6
      ? 1
      : sleepDurationLastNightHrs < 7
      ? 0.5
      : 0;

  const debt =
    sleepDebtHrs != null
      ? Math.min(1, sleepDebtHrs / 2.5) // 2.5+ hours → saturate
      : 0;

  const sleepStress = Math.max(shortSleep, debt); // combine

  /* ----------------------------------------
     2. Daytime load component
  ---------------------------------------- */
  const highAZM = azmToday != null ? Math.min(1, azmToday / 60) : 0;
  const highSteps =
    stepsZToday != null
      ? stepsZToday > 1
        ? 1
        : stepsZToday < 0
        ? 0
        : stepsZToday
      : 0;

  const dayLoad = 0.6 * highAZM + 0.4 * highSteps;

  /* ----------------------------------------
     3. Recent heavy exercise (within last 6h)
  ---------------------------------------- */
  let recentExercise = 0;
  if (
    lastExerciseDurationMinutes != null &&
    lastExerciseDurationMinutes >= 40 &&
    hoursSinceLastExercise != null &&
    hoursSinceLastExercise <= 6
  ) {
    recentExercise = 0.7;
  }

  /* ----------------------------------------
     4. HR confirmation (stress load)
  ---------------------------------------- */
  const hrComponent = hrZNow != null && hrZNow > 0.5 ? 0.4 : 0;

  /* ----------------------------------------
     5. Final score (0–1)
  ---------------------------------------- */
  let score = 0.6 * sleepStress + 0.4 * dayLoad + recentExercise + hrComponent;

  if (score > 1) score = 1;
  if (score < 0) score = 0;

  return { lowSleepHighActivityFlag: score };
}
