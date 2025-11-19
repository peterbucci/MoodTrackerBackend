import dayjs from "dayjs";

// p.time is just a clock time from Fitbit: "HH:mm" or "HH:mm:ss"
function parseTimeToMinutes(timeStr) {
  console.log(timeStr);
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

function sumWindow(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let s = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM > startM && tM <= nowM) s += p.steps || 0;
  }
  return s;
}

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

function longestZeroStreak(series, now, minutes) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - minutes;
  let run = 0;
  let best = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM > startM && tM <= nowM) {
      if ((p.steps || 0) === 0) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
  }
  return best;
}

function slopeLast60(series, now) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 60;

  const pts = (series || [])
    .map((p) => ({
      x: parseTimeToMinutes(p.time),
      y: p.steps || 0,
    }))
    .filter((pt) => pt.x > startM && pt.x <= nowM);

  if (pts.length < 2) return 0;

  const n = pts.length;
  const meanX = pts.reduce((a, b) => a + b.x, 0) / n;
  const meanY = pts.reduce((a, b) => a + b.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const { x, y } of pts) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) * (x - meanX);
  }

  return den === 0 ? 0 : num / den; // per-minute slope
}

// Sedentary minutes in last 3h using steps=0
export function sedentaryMinsLast3hFromSteps(series, now = dayjs()) {
  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 180;
  let mins = 0;
  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM > startM && tM <= nowM) {
      mins += (p.steps || 0) === 0 ? 1 : 0;
    }
  }
  return mins;
}

// azmSpike30m = activeMinutes(last 30m) - activeMinutes(previous 30m)
export function azmSpike30mFromSteps(series, now = dayjs()) {
  const threshold = 60; // steps per minute to count as "active"
  const nowM = minutesSinceMidnight(now);
  const midM = nowM - 30;
  const startM = nowM - 60;

  let activePrev30 = 0;
  let activeLast30 = 0;

  for (const p of series || []) {
    const tM = parseTimeToMinutes(p.time);
    if (tM <= startM || tM > nowM) continue;

    const steps = p.steps || 0;
    if (steps < threshold) continue;

    if (tM > startM && tM <= midM) {
      activePrev30 += 1;
    } else if (tM > midM && tM <= nowM) {
      activeLast30 += 1;
    }
  }

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
