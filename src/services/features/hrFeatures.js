import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
} from "../../utils/timeUtils.js";

/**
 * Compute averages over sliding windows in minutes.
 * @param {*} series - time series of HR data
 * @param {*} now - current time
 * @param {*} minutes - window size in minutes
 * @param {*} offsetMinutes - offset to shift the window back
 * @returns average HR within the window
 */
function avgWindow(series, now, minutes, offsetMinutes = 0) {
  const endM = minutesSinceMidnight(now) - offsetMinutes;
  const startM = endM - minutes;
  let sum = 0;
  let count = 0;

  // Iterate through the series to compute sum and count
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    // Check if the time is within the window
    if (tM <= startM || tM > endM) continue;
    // Only include valid HR values
    if (typeof p.hr === "number") {
      sum += p.hr;
      count += 1;
    }
  }

  return count > 0 ? sum / count : null;
}

/**
 * Compute relative elevation of current HR vs resting HR baseline from 7-day data.
 * In other words, how much above or below resting HR is the current HR, expressed as a fraction of resting HR.
 *  - 0.0   → at baseline
 *  - 0.2   → 20% above resting
 *  - -0.1  → 10% below resting
 * @param {*} rhr7dJson - JSON object with 7-day resting heart rate data
 * @param {*} hrNow - current heart rate
 * @returns relative elevation of current HR vs resting baseline
 */
function computeHrZNow(rhr7dJson, hrNow) {
  if (hrNow == null) return null;

  // Extract resting HR values from 7-day JSON
  const arr = Array.isArray(rhr7dJson?.["activities-heart"])
    ? rhr7dJson["activities-heart"]
    : [];

  // Pull out all restingHeartRate values
  const values = arr
    .map((e) => e?.value?.restingHeartRate)
    .filter((v) => typeof v === "number");

  // if no valid resting HR values, return null
  if (values.length < 1) return null;

  // Compute mean resting HR
  const n = values.length;
  const mean = values.reduce((acc, v) => acc + v, 0) / n;

  // Avoid division by zero or negative means
  if (!mean || mean <= 0) return null;

  // Relative elevation vs resting baseline
  return (hrNow - mean) / mean;
}

/**
 * Build acute HR features from intraday HR + RHR 7d baseline.
 * - hrAvgLast5m
 * - hrAvgLast15m
 * - hrDelta5m  (last 5m - prior 5m)
 * - hrDelta15m (last 15m - prior 15m)
 * - hrZNow     (z-score vs 7d resting HR baseline)
 * @param {*} heartSeries - time series of HR data
 * @param {*} rhr7dJson - JSON object with 7-day resting heart rate data
 * @param {*} now - current time
 * @returns object with computed HR features
 */
export function featuresFromHeartIntraday(
  heartSeries,
  rhr7dJson,
  now = dayjs()
) {
  // Compute averages for last windows
  const hrAvgLast5m = avgWindow(heartSeries, now, 5, 0);
  const hrAvgLast15m = avgWindow(heartSeries, now, 15, 0);

  // Compute prior windows for deltas
  const prior5 = avgWindow(heartSeries, now, 5, 5);
  const prior15 = avgWindow(heartSeries, now, 15, 15);

  // Compute deltas
  const hrDelta5m =
    hrAvgLast5m != null && prior5 != null ? hrAvgLast5m - prior5 : null;
  const hrDelta15m =
    hrAvgLast15m != null && prior15 != null ? hrAvgLast15m - prior15 : null;

  // Compute hrZNow
  const hrZNow = computeHrZNow(rhr7dJson, hrAvgLast5m ?? hrAvgLast15m ?? null);

  return {
    hrAvgLast5m,
    hrAvgLast15m,
    hrDelta5m,
    hrDelta15m,
    hrZNow,
  };
}
