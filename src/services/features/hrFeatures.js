import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
  normalizeMinutesForWindow,
} from "../../utils/timeUtils.js";

/**
 * Collect HR samples (x = minutes since midnight, y = hr) in a window.
 */
function collectHrWindow(series, now, minutes, offsetMinutes = 0) {
  const endM = minutesSinceMidnight(now) - offsetMinutes;
  const startM = endM - minutes;
  const pts = [];

  for (const p of series || []) {
    const raw = parseTimeToMinutes(p.time);
    const tM = normalizeMinutesForWindow(raw, endM);
    if (tM == null) continue;
    if (tM <= startM || tM > endM) continue;
    if (typeof p.hr === "number") {
      pts.push({ x: tM, y: p.hr });
    }
  }

  return pts;
}

/**
 * Simple mean of HR in a window.
 */
function avgWindow(series, now, minutes, offsetMinutes = 0) {
  const pts = collectHrWindow(series, now, minutes, offsetMinutes);
  if (pts.length === 0) return null;

  let sum = 0;
  for (const { y } of pts) sum += y;
  return sum / pts.length;
}

/**
 * Min / max / std of HR in a window.
 */
function statsWindow(series, now, minutes, offsetMinutes = 0) {
  const pts = collectHrWindow(series, now, minutes, offsetMinutes);
  const n = pts.length;
  if (n === 0) {
    return { min: null, max: null, std: null };
  }

  let min = pts[0].y;
  let max = pts[0].y;
  let sum = 0;

  for (const { y } of pts) {
    if (y < min) min = y;
    if (y > max) max = y;
    sum += y;
  }

  const mean = sum / n;
  let varSum = 0;
  for (const { y } of pts) {
    const d = y - mean;
    varSum += d * d;
  }
  const std = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;

  return { min, max, std };
}

/**
 * Regression slope of HR vs. time (minutes) over a window.
 * Returns slope in "bpm per minute".
 */
function slopeWindow(series, now, minutes, offsetMinutes = 0) {
  const pts = collectHrWindow(series, now, minutes, offsetMinutes);
  const n = pts.length;
  if (n < 2) return null;

  const sumX = pts.reduce((a, p) => a + p.x, 0);
  const sumY = pts.reduce((a, p) => a + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const { x, y } of pts) {
    const dx = x - meanX;
    num += dx * (y - meanY);
    den += dx * dx;
  }

  if (den === 0) return null;
  return num / den;
}

/**
 * Current HR = last sample at or before "now".
 */
function currentHr(heartSeries, now) {
  const nowM = minutesSinceMidnight(now);
  let best = null;
  let bestT = -Infinity;

  for (const p of heartSeries || []) {
    if (typeof p.hr !== "number") continue;
    const raw = parseTimeToMinutes(p.time);
    const tM = normalizeMinutesForWindow(raw, nowM);
    if (tM == null) continue;
    if (tM <= nowM && tM > bestT) {
      bestT = tM;
      best = p.hr;
    }
  }

  return best;
}

/**
 * Compute baseline mean & std of 7-day resting HR.
 */
function computeRhrStats(rhr7dJson) {
  const arr = Array.isArray(rhr7dJson?.["activities-heart"])
    ? rhr7dJson["activities-heart"]
    : [];

  const vals = arr
    .map((e) => e?.value?.restingHeartRate)
    .filter((v) => typeof v === "number");

  if (vals.length === 0) {
    return { rhrMean7d: null, rhrStd7d: null };
  }

  const n = vals.length;
  const mean = vals.reduce((acc, v) => acc + v, 0) / n;

  let varSum = 0;
  for (const v of vals) {
    const d = v - mean;
    varSum += d * d;
  }
  const std = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;

  return { rhrMean7d: mean, rhrStd7d: std };
}

/**
 * Relative elevation of HR vs baseline.
 * Returns null if baseline is missing/invalid.
 */
function hrZ(relativeHr, rhrMean7d) {
  if (relativeHr == null || rhrMean7d == null || rhrMean7d <= 0) {
    return null;
  }
  return (relativeHr - rhrMean7d) / rhrMean7d;
}

/**
 * Build acute HR features from intraday HR + RHR 7d baseline.
 *
 * Returns (all optional if data is sparse):
 *  - hrNow
 *  - hrAvgLast5m, hrAvgLast15m, hrAvgLast60m
 *  - hrMinLast15m, hrMaxLast15m
 *  - hrDelta5m, hrDelta15m
 *  - hrSlopeLast30m, hrStdLast30m
 *  - rhrMean7d, rhrStd7d
 *  - hrZNow, hrZLast15m
 */
export function featuresFromHeartIntraday(
  heartSeries,
  rhr7dJson,
  now = dayjs()
) {
  // window means
  const hrAvgLast5m = avgWindow(heartSeries, now, 5, 0);
  const hrAvgLast15m = avgWindow(heartSeries, now, 15, 0);
  const hrAvgLast60m = avgWindow(heartSeries, now, 60, 0);

  // prior windows for deltas
  const prior5 = avgWindow(heartSeries, now, 5, 5);
  const prior15 = avgWindow(heartSeries, now, 15, 15);

  const hrDelta5m =
    hrAvgLast5m != null && prior5 != null ? hrAvgLast5m - prior5 : null;
  const hrDelta15m =
    hrAvgLast15m != null && prior15 != null ? hrAvgLast15m - prior15 : null;

  // range + variability over last 15/30 mins
  const { min: hrMinLast15m, max: hrMaxLast15m } = statsWindow(
    heartSeries,
    now,
    15,
    0
  );
  const { std: hrStdLast30m } = statsWindow(heartSeries, now, 30, 0);

  // local trend over last 30 mins
  const hrSlopeLast30m = slopeWindow(heartSeries, now, 30, 0);

  // 60-minute variability & slope
  const { std: hrStdLast60m } = statsWindow(heartSeries, now, 60, 0);
  const hrSlopeLast60m = slopeWindow(heartSeries, now, 60, 0);

  // baseline stats
  const { rhrMean7d, rhrStd7d } = computeRhrStats(rhr7dJson);

  // current HR and z-scores
  const hrNow = currentHr(heartSeries, now);
  const hrZNow = hrZ(hrNow ?? hrAvgLast5m ?? hrAvgLast15m ?? null, rhrMean7d);
  const hrZLast15m = hrZ(hrAvgLast15m ?? null, rhrMean7d);

  return {
    hrNow,

    hrAvgLast5m,
    hrAvgLast15m,
    hrAvgLast60m,

    hrMinLast15m,
    hrMaxLast15m,

    hrDelta5m,
    hrDelta15m,

    hrSlopeLast30m,
    hrStdLast30m,

    hrStdLast60m,
    hrSlopeLast60m,

    rhrMean7d,
    rhrStd7d,

    hrZNow,
    hrZLast15m,
  };
}
