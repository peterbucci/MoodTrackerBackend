import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
} from "../../utils/timeUtils.js";

/**
 * Compute sums over sliding windows in minutes.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @param {*} minutes - window size in minutes
 * @returns sum of steps within the window
 */
function sumWindow(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  // Subtracting the time since midnight from now gives the start of the window
  const startM = nowM - minutes;
  let s = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    // Check if the time is within the window
    if (tM > startM && tM <= nowM) s += p.steps || 0; // only add valid steps
  }
  return s;
}

/**
 * Find the maximum steps in any single minute within the last N minutes.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @param {*} minutes - window size in minutes
 * @returns maximum steps in any one minute within the window
 */
function maxOneMinInLast(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let m = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM > startM && tM <= nowM) m = Math.max(m, p.steps || 0);
  }
  return m;
}

/**
 * Find the longest streak of consecutive zero-step minutes within the last N minutes.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @param {*} minutes - window size in minutes
 * @returns length of the longest zero-step streak within the window
 */
function longestZeroStreak(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let run = 0; // current streak
  let best = 0; // best streak found
  // Iterate through the series to find zero-step streaks
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    // Only consider points within the time window
    if (tM > startM && tM <= nowM) {
      // Check if steps are zero
      if ((p.steps || 0) === 0) {
        run += 1; // extend current streak
        best = Math.max(best, run); // update best streak if needed
      } else {
        run = 0; // reset current streak when steps are non-zero
      }
    }
  }
  return best;
}

/**
 * Compute the change in steps per minute over the last 60 minutes.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @returns slope of steps per minute over the last 60 minutes
 */
function slopeLast60(series, now) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 60;

  // Collect points within the last 60 minutes
  const pts = (series || [])
    .map((p) => ({
      x: parseTimeToMinutes(p.time),
      y: p.steps || 0,
    }))
    .filter((pt) => pt.x > startM && pt.x <= nowM);

  // Not enough points to compute a slope
  if (pts.length < 2) return 0;

  const n = pts.length;
  const meanX = pts.reduce((a, b) => a + b.x, 0) / n; // average time in minutes
  const meanY = pts.reduce((a, b) => a + b.y, 0) / n; // average steps

  let num = 0;
  let den = 0;
  // Compute covariance and variance for slope calculation
  for (const { x, y } of pts) {
    num += (x - meanX) * (y - meanY); // covariance
    den += (x - meanX) * (x - meanX); // variance
  }

  return den === 0 ? 0 : num / den; // slope (steps per minute)
}

/**
 * Compute sedentary minutes in the last 3 hours from step data.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @returns number of sedentary minutes in the last 3 hours
 */
export function sedentaryMinsLast3hFromSteps(series, now = dayjs()) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 180;
  let mins = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM > startM && tM <= nowM) {
      mins += (p.steps || 0) === 0 ? 1 : 0; // count zero-step minutes
    }
  }
  return mins;
}

/**
 * Compute the change in active minutes between the last 30 minutes and the prior 30 minutes.
 * An active minute is defined as having at least 60 steps.
 * @param {*} series - time series of step data
 * @param {*} now - current time
 * @returns difference in active minutes between the last 30 minutes and the prior 30 minutes
 */
export function azmSpike30mFromSteps(series, now = dayjs()) {
  const threshold = 60; // steps per minute to count as "active"
  const nowM = minutesSinceMidnight(now); // current time in minutes since midnight
  const midM = nowM - 30; // midpoint of the 30-minute window
  const startM = nowM - 60; // start of the 60-minute window

  let activePrev30 = 0; // active minutes in the prior 30 minutes
  let activeLast30 = 0; // active minutes in the last 30 minutes

  // Iterate through the series to count active minutes
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM <= startM || tM > nowM) continue;

    const steps = p.steps || 0;
    if (steps < threshold) continue; // not an active minute

    if (tM > startM && tM <= midM) {
      // prior 30 minutes
      activePrev30 += 1;
    } else if (tM > midM && tM <= nowM) {
      // last 30 minutes
      activeLast30 += 1;
    }
  }

  // Return the difference in active minutes
  return activeLast30 - activePrev30;
}

export function featuresFromSteps(series, now = dayjs()) {
  const f = {};
  f.stepsLast5m = sumWindow(series, now, 5);
  f.stepsLast30m = sumWindow(series, now, 30);
  f.stepsLast60m = sumWindow(series, now, 60);
  f.stepsLast3h = sumWindow(series, now, 180);
  f.stepBurst5m = maxOneMinInLast(series, now, 5);
  f.zeroStreakMax60m = longestZeroStreak(series, now, 60);
  f.stepsSlopeLast60m = slopeLast60(series, now);
  const last5 = sumWindow(series, now, 5);
  const last15 = sumWindow(series, now, 15);
  f.stepsAccel5to15m = (last15 - last5) / 10.0;
  return f;
}
