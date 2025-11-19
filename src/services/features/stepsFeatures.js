import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
} from "../../utils/timeUtils.js";

/**
 * Sum steps over the last `minutes` minutes.
 * series: [{ time: ISO or HH:mm, steps: number }, ...]
 */
function sumWindow(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let s = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    // strictly (startM, nowM]
    if (tM > startM && tM <= nowM) {
      s += p.steps || 0;
    }
  }
  return s;
}

/**
 * Maximum steps in any one minute in the last `minutes` minutes.
 */
function maxOneMinInLast(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let m = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      m = Math.max(m, p.steps || 0);
    }
  }
  return m;
}

/**
 * Longest streak (in minutes) of zero-step minutes in the last `minutes` minutes.
 */
function longestZeroStreak(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let run = 0;
  let best = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      if ((p.steps || 0) === 0) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
  }
  return best;
}

/**
 * Linear regression slope of steps vs time over the last 60 minutes.
 * Returns steps per minute.
 */
function slopeLast60(series, now) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 60;

  const pts = (series || [])
    .map((p) => ({
      x: parseTimeToMinutes(p.time),
      y: p.steps || 0,
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
 * Sedentary minutes (0 steps) in the last 3 hours.
 */
export function sedentaryMinsLast3hFromSteps(series, now = dayjs()) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 180;
  let mins = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;

    if (tM > startM && tM <= nowM) {
      if ((p.steps || 0) === 0) mins += 1;
    }
  }
  return mins;
}

/**
 * "Activity spike" in the last 30 minutes vs the previous 30.
 * Uses a simple step threshold (~brisk walking) as a proxy for AZM.
 */
export function azmSpike30mFromSteps(series, now = dayjs()) {
  const ACTIVE_STEPS_PER_MIN = 60;
  const nowM = minutesSinceMidnight(now);
  const midM = nowM - 30;
  const startM = nowM - 60;

  let activePrev30 = 0;
  let activeLast30 = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (!Number.isFinite(tM)) continue;
    if (tM <= startM || tM > nowM) continue;

    const steps = p.steps || 0;
    if (steps < ACTIVE_STEPS_PER_MIN) continue;

    if (tM > startM && tM <= midM) {
      activePrev30 += 1;
    } else if (tM > midM && tM <= nowM) {
      activeLast30 += 1;
    }
  }

  return activeLast30 - activePrev30;
}

/**
 * Core step-derived features around `now`.
 */
export function featuresFromSteps(series, now = dayjs()) {
  const s = Array.isArray(series) ? series : [];

  const stepsLast5m = sumWindow(s, now, 5);
  const stepsLast15m = sumWindow(s, now, 15);
  const stepsLast30m = sumWindow(s, now, 30);
  const stepsLast60m = sumWindow(s, now, 60);
  const stepsLast3h = sumWindow(s, now, 180);

  const stepBurst5m = maxOneMinInLast(s, now, 5);
  const zeroStreakMax60m = longestZeroStreak(s, now, 60);
  const stepsSlopeLast60m = slopeLast60(s, now);

  const stepsAccel5to15m = (stepsLast15m - stepsLast5m) / 10.0;

  return {
    stepsLast5m,
    stepsLast15m,
    stepsLast30m,
    stepsLast60m,
    stepsLast3h,
    stepBurst5m,
    zeroStreakMax60m,
    stepsSlopeLast60m,
    stepsAccel5to15m,
  };
}
