import dayjs from "dayjs";

export function featuresFromDailySummary(summaryJson, now = dayjs()) {
  const summary = summaryJson?.summary || {};

  // 1) Try real Active Zone Minutes if Fitbit ever starts sending it
  let azmToday = null;
  if (summary.activeZoneMinutes?.totalMinutes != null) {
    azmToday = summary.activeZoneMinutes.totalMinutes;
  } else if (
    typeof summary.fairlyActiveMinutes === "number" ||
    typeof summary.veryActiveMinutes === "number"
  ) {
    // 2) Fallback: approximate AZM from legacy fields (your call)
    // Simple version: count fairly+very active minutes as "zone" time
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
