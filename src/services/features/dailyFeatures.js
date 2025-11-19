import dayjs from "dayjs";

/**
 * Compute daily features from Fitbit API /activities/summary endpoint.
 * @param {*} summaryJson - Fitbit daily summary JSON
 * @param {*} now - dayjs() object for "now"
 * @returns daily features
 */
export function featuresFromDailySummary(summaryJson, now = dayjs()) {
  const summary = summaryJson?.summary || {};

  // Try real Active Zone Minutes
  let azmToday = null;
  if (summary.activeZoneMinutes?.totalMinutes != null) {
    azmToday = summary.activeZoneMinutes.totalMinutes;
  } else if (
    typeof summary.fairlyActiveMinutes === "number" ||
    typeof summary.veryActiveMinutes === "number"
  ) {
    // Fallback: approximate AZM from fairly+very active mins as "zone" time
    azmToday =
      (summary.fairlyActiveMinutes || 0) + (summary.veryActiveMinutes || 0);
  }

  const caloriesOutToday =
    typeof summary?.caloriesOut === "number" ? summary.caloriesOut : null;

  const restingHR =
    typeof summary?.restingHeartRate === "number"
      ? summary.restingHeartRate
      : null;

  const hourOfDay = now.hour();
  const dayOfWeek = now.day(); // 0=Sun..6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return {
    azmToday,
    caloriesOutToday,
    restingHR,
    hourOfDay,
    dayOfWeek,
    isWeekend,
  };
}
