import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
} from "../../utils/timeUtils.js";

/**
 * Sum of specific AZM sub-metric over a window.
 * metric = "activeZoneMinutes" | "fatBurnActiveZoneMinutes" | "cardioActiveZoneMinutes" | "peakActiveZoneMinutes"
 */
function sumAzmWindow(series, now, minutes, metric) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;

  let total = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      total += p[metric] ?? 0;
    }
  }

  return total;
}

/**
 * Count minutes where any AZM > 0 in window.
 */
function countIntensityMinutes(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;

  let c = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      const v = p.activeZoneMinutes ?? 0;
      if (v > 0) c += 1;
    }
  }
  return c;
}

/**
 * Longest streak of *no AZM* inactivity in window.
 */
function longestNoAzmStreak(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;

  let run = 0;
  let best = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      const v = p.activeZoneMinutes ?? 0;
      if (v === 0) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
  }
  return best;
}

/**
 * Slope of AZM (total activeZoneMinutes) over last 60 min.
 */
function azmSlopeLast60(series, now) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 60;

  const pts = (series || [])
    .map((p) => ({
      x: parseTimeToMinutes(p.time),
      y: p.activeZoneMinutes ?? 0,
    }))
    .filter((pt) => Number.isFinite(pt.x) && pt.x > startM && pt.x <= nowM);

  if (pts.length < 2) return 0;

  const n = pts.length;
  const meanX = pts.reduce((a, b) => a + b.x, 0) / n;
  const meanY = pts.reduce((a, b) => a + b.y, 0) / n;

  let num = 0;
  let den = 0;

  for (const { x, y } of pts) {
    const dx = x - meanX;
    num += dx * (y - meanY);
    den += dx * dx;
  }

  return den === 0 ? 0 : num / den;
}

/**
 * Compare last 30 minutes vs prior 30 minutes for real AZM,
 * like your step-based azmSpike but using legit AZM.
 */
function azmSpike30m(series, now) {
  const nowM = minutesSinceMidnight(now);
  const midM = nowM - 30;
  const startM = nowM - 60;

  let prev30 = 0;
  let last30 = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM <= startM || tM > nowM) continue;

    const v = p.activeZoneMinutes ?? 0;

    if (tM > startM && tM <= midM) prev30 += v;
    else if (tM > midM && tM <= nowM) last30 += v;
  }

  return last30 - prev30;
}

/**
 * Real AZM feature extraction.
 * series items = {
 *   time: ISO string,
 *   activeZoneMinutes,
 *   fatBurnActiveZoneMinutes,
 *   cardioActiveZoneMinutes,
 *   peakActiveZoneMinutes
 * }
 */
export function featuresFromAzm(series, now = dayjs()) {
  const s = Array.isArray(series) ? series : [];

  return {
    // totals over windows
    azmLast30m: sumAzmWindow(s, now, 30, "activeZoneMinutes"),
    azmLast60m: sumAzmWindow(s, now, 60, "activeZoneMinutes"),

    // zone-specific
    azmFatBurnLast30m: sumAzmWindow(s, now, 30, "fatBurnActiveZoneMinutes"),
    azmCardioLast30m: sumAzmWindow(s, now, 30, "cardioActiveZoneMinutes"),
    azmPeakLast30m: sumAzmWindow(s, now, 30, "peakActiveZoneMinutes"),

    // intensity minutes
    azmIntensityMinutes30m: countIntensityMinutes(s, now, 30),
    azmIntensityMinutes60m: countIntensityMinutes(s, now, 60),

    // inactivity streaks
    azmZeroStreakMax60m: longestNoAzmStreak(s, now, 60),

    // trend
    azmSlopeLast60m: azmSlopeLast60(s, now),

    // spike
    azmSpike30m: azmSpike30m(s, now),
  };
}
