export function recentActivityXTimeOfDayFeature({
  stepsLast60m,
  stepsZToday,
  hourOfDay,
  isWeekend,
}) {
  if (stepsLast60m == null || hourOfDay == null) {
    return { recentActivityXTimeOfDay: 0 };
  }

  // Coarse bins
  let bin = "other";
  if (hourOfDay >= 0 && hourOfDay < 6) bin = "night";
  else if (hourOfDay >= 6 && hourOfDay < 12) bin = "morning";
  else if (hourOfDay >= 12 && hourOfDay < 18) bin = "afternoon";
  else bin = "evening";

  // Rough expected thresholds for "pretty active" last 60m
  let threshold;
  switch (bin) {
    case "night":
      threshold = 200; // any real movement at night is unusual
      break;
    case "morning":
      threshold = 600;
      break;
    case "afternoon":
      threshold = 800;
      break;
    case "evening":
      threshold = 500;
      break;
    default:
      threshold = 600;
  }

  // Weekends: allow a bit more activity before it's "weird"
  if (isWeekend) threshold *= 1.3;

  const highActivityNow = stepsLast60m >= threshold;
  const lowActivityNow = stepsLast60m <= 50; // basically nothing

  // Optionally bias by how "active today" is overall
  const veryActiveDay = stepsZToday != null && stepsZToday > 1.5;
  const veryInactiveDay = stepsZToday != null && stepsZToday < -1.0;

  let score = 0;

  // High activity in unusual times
  if (bin === "night" && highActivityNow) score = +2;
  else if (bin === "evening" && highActivityNow && !isWeekend) score = +1;
  else if (bin === "morning" && highActivityNow && !isWeekend) score = +1;

  // Very low activity when you'd expect some movement
  if ((bin === "morning" || bin === "afternoon") && lowActivityNow) {
    score = score <= 0 ? -1 : score; // don't overwrite strong positive
  }

  // Nudge by overall day pattern
  if (score > 0 && veryActiveDay) score += 0.5;
  if (score < 0 && veryInactiveDay) score -= 0.5;

  return { recentActivityXTimeOfDay: score };
}

export function lowSleepHighActivityFlagFeature({
  sleepDurationLastNightHrs,
  sleepDebtHrs,
  stepsZToday,
  azmToday,
}) {
  // If we don't have sleep, just bail
  if (sleepDurationLastNightHrs == null && sleepDebtHrs == null) {
    return { lowSleepHighActivityFlag: 0 };
  }

  const shortSleep =
    sleepDurationLastNightHrs != null &&
    sleepDurationLastNightHrs > 0 &&
    sleepDurationLastNightHrs < 6; // < 6h

  const highSleepDebt = sleepDebtHrs != null && sleepDebtHrs >= 1.5; // >= 1.5h average debt

  // "Pushing hard" today
  const veryActiveDay = stepsZToday != null && stepsZToday > 1.0; // > 1 SD above normal
  const highAZM = azmToday != null && azmToday >= 45; // e.g. 45+ zone minutes

  const highLoadToday = veryActiveDay || highAZM;

  const flag = (shortSleep || highSleepDebt) && highLoadToday ? 1 : 0;

  return { lowSleepHighActivityFlag: flag };
}
