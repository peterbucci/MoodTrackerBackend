import dayjs from "dayjs";

function sumWindow(series, now, minutes) {
  const start = now.subtract(minutes, "minute");
  let s = 0;
  for (const p of series) {
    const t = dayjs(p.time);
    if (t.isAfter(start) && !t.isAfter(now)) s += p.steps || 0;
  }
  return s;
}

function maxOneMinInLast(series, now, minutes) {
  const start = now.subtract(minutes, "minute");
  let m = 0;
  for (const p of series) {
    const t = dayjs(p.time);
    if (t.isAfter(start) && !t.isAfter(now)) m = Math.max(m, p.steps || 0);
  }
  return m;
}

function longestZeroStreak(series, now, minutes) {
  const start = now.subtract(minutes, "minute");
  let run = 0,
    best = 0;
  for (const p of series) {
    const t = dayjs(p.time);
    if (t.isAfter(start) && !t.isAfter(now)) {
      if ((p.steps || 0) === 0) {
        run += 1;
        best = Math.max(best, run);
      } else run = 0;
    }
  }
  return best;
}

function slopeLast60(series, now) {
  const start = now.subtract(60, "minute");
  const pts = series
    .filter((p) => {
      const t = dayjs(p.time);
      return t.isAfter(start) && !t.isAfter(now);
    })
    .map((p) => ({ x: dayjs(p.time).valueOf(), y: p.steps || 0 }));
  if (pts.length < 2) return 0;
  const n = pts.length;
  const meanX = pts.reduce((a, b) => a + b.x, 0) / n;
  const meanY = pts.reduce((a, b) => a + b.y, 0) / n;
  let num = 0,
    den = 0;
  for (const { x, y } of pts) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) * (x - meanX);
  }
  return den === 0 ? 0 : (num / den) * 60 * 1000; // per-minute
}

// Sedentary minutes in last 3h using steps=0 proxy
export function sedentaryMinsLast3hFromSteps(series, now = dayjs()) {
  const start = now.subtract(180, "minute");
  let mins = 0;
  for (const p of series) {
    const t = dayjs(p.time);
    if (t.isAfter(start) && !t.isAfter(now))
      mins += (p.steps || 0) === 0 ? 1 : 0;
  }
  return mins;
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
