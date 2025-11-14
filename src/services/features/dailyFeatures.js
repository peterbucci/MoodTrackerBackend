import dayjs from "dayjs";

export function featuresFromDailySummary(summaryJson, now = dayjs()) {
  const summary = summaryJson?.summary || {};
  const azmToday =
    summary?.activeZoneMinutes?.totalMinutes ??
    (typeof summary?.activeScore === "number" ? summary.activeScore : null);

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
