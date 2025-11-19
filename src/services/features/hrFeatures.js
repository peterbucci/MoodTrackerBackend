import dayjs from "dayjs";

function timeOnSameDay(now, timeStr) {
  // p.time is "HH:mm:ss"
  const [h, m, s] = timeStr.split(":").map((n) => parseInt(n, 10) || 0);
  // dayjs is immutable, this returns a *new* dayjs, doesn't mutate now
  return now.hour(h).minute(m).second(s).millisecond(0);
}

/**
 * Compute averages over sliding windows in minutes.
 * offsetMinutes lets you shift the window back (for "prior" periods).
 */
function avgWindow(series, now, minutes, offsetMinutes = 0) {
  const end = now.subtract(offsetMinutes, "minute");
  const start = end.subtract(minutes, "minute");
  let sum = 0;
  let count = 0;
  for (const p of series || []) {
    const t = timeOnSameDay(now, p.time);
    if (!t.isAfter(start) || t.isAfter(end)) continue;
    const hr = typeof p.hr === "number" ? p.hr : null;
    if (hr != null) {
      sum += hr;
      count += 1;
    }
  }
  return count > 0 ? sum / count : null;
}

// hrZNow: how elevated current HR is vs resting baseline.
//   0.0   → at baseline
//   0.2   → 20% above resting
//   -0.1  → 10% below resting
function computeHrZNow(rhr7dJson, hrNow) {
  if (hrNow == null) return null;

  const arr = Array.isArray(rhr7dJson?.["activities-heart"])
    ? rhr7dJson["activities-heart"]
    : [];

  const values = arr
    .map((e) => e?.value?.restingHeartRate)
    .filter((v) => typeof v === "number");

  if (values.length < 1) return null;

  const n = values.length;
  const mean = values.reduce((acc, v) => acc + v, 0) / n;

  if (!mean || mean <= 0) return null;

  // Relative elevation vs resting baseline
  return (hrNow - mean) / mean;
}

/**
 * Build acute HR features from intraday HR + RHR 7d baseline.
 *
 * - hrAvgLast5m
 * - hrAvgLast15m
 * - hrDelta5m  (last 5m - prior 5m)
 * - hrDelta15m (last 15m - prior 15m)
 * - hrZNow     (z-score vs 7d resting HR baseline)
 */
export function featuresFromHeartIntraday(
  heartSeries,
  rhr7dJson,
  now = dayjs()
) {
  const hrAvgLast5m = avgWindow(heartSeries, now, 5, 0);
  const hrAvgLast15m = avgWindow(heartSeries, now, 15, 0);

  const prior5 = avgWindow(heartSeries, now, 5, 5);
  const prior15 = avgWindow(heartSeries, now, 15, 15);

  const hrDelta5m =
    hrAvgLast5m != null && prior5 != null ? hrAvgLast5m - prior5 : null;
  const hrDelta15m =
    hrAvgLast15m != null && prior15 != null ? hrAvgLast15m - prior15 : null;

  const hrZNow = computeHrZNow(rhr7dJson, hrAvgLast5m ?? hrAvgLast15m ?? null);

  return {
    hrAvgLast5m,
    hrAvgLast15m,
    hrDelta5m,
    hrDelta15m,
    hrZNow,
  };
}
