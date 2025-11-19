import dayjs from "dayjs";

// p.time is just a clock time from Fitbit: "HH:mm" or "HH:mm:ss"
function parseTimeToMinutes(timeStr) {
  const parts = String(timeStr).split(":");
  const h = parseInt(parts[0] || "0", 10) || 0;
  const m = parseInt(parts[1] || "0", 10) || 0;
  const s = parts[2] ? parseInt(parts[2], 10) || 0 : 0;
  return h * 60 + m + s / 60;
}

// minutes since midnight on the *client* day (from `now`)
function minutesSinceMidnight(now) {
  return now.hour() * 60 + now.minute() + now.second() / 60;
}

/**
 * Compute averages over sliding windows in minutes.
 * offsetMinutes lets you shift the window back (for "prior" periods).
 */
function avgWindow(series, now, minutes, offsetMinutes = 0) {
  const endM = minutesSinceMidnight(now) - offsetMinutes;
  const startM = endM - minutes;
  let sum = 0;
  let count = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM <= startM || tM > endM) continue;

    // primary: p.hr, fallback: p.value if that's how Fitbit data is shaped
    let hr = null;
    if (typeof p.hr === "number") {
      hr = p.hr;
    } else if (typeof p.value === "number") {
      hr = p.value;
    }

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
