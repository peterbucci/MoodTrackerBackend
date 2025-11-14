import dayjs from "dayjs";

/**
 * stepsZToday: z-score of today's daily steps compared to the
 * previous days in the 7-day window.
 *
 * steps7dJson shape (Fitbit /activities/steps/date/[date]/7d.json):
 *   { "activities-steps": [ { dateTime: "YYYY-MM-DD", value: "1234" }, ... ] }
 */
export function stepsZTodayFromTimeseries(steps7dJson) {
  const arr = Array.isArray(steps7dJson?.["activities-steps"])
    ? steps7dJson["activities-steps"]
    : [];

  if (arr.length < 2) return null;

  const values = arr
    .map((d) => {
      const v = Number(d.value);
      return Number.isFinite(v) ? v : null;
    })
    .filter((v) => v != null);

  if (values.length < 2) return null;

  const today = values[values.length - 1];
  const prior = values.slice(0, -1);

  if (!Number.isFinite(today) || !prior.length) return null;

  const mean = prior.reduce((sum, v) => sum + v, 0) / prior.length;
  const variance =
    prior.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / prior.length;
  const std = Math.sqrt(variance);

  if (!std || !Number.isFinite(std)) return null;

  return (today - mean) / std;
}

/**
 * activityInertia: trend of daily steps over the last days.
 *
 * Intuition:
 * - Fit a simple linear regression over the 7-day daily steps.
 * - Normalize slope by mean steps (so it's scale-free).
 * - Flip sign so "worse trend" (steps going down) => larger positive value.
 */
export function activityInertiaFromSteps7d(steps7dJson) {
  const arr = Array.isArray(steps7dJson?.["activities-steps"])
    ? steps7dJson["activities-steps"]
    : [];

  const vals = arr
    .map((d) => {
      const v = Number(d.value);
      return Number.isFinite(v) ? v : null;
    })
    .filter((v) => v != null);

  if (vals.length < 2) return null;

  const n = vals.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = vals.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = vals[i] - meanY;
    num += dx * dy;
    den += dx * dx;
  }
  if (!den) return null;

  const slope = num / den; // steps per day
  const norm = meanY > 0 ? slope / meanY : slope;

  // Flip sign: positive inertia means a downward trend in activity.
  return -norm;
}

/**
 * sleepDebtHrs: simple estimate using the last up-to-3 main sleeps.
 *
 * Target = 8 hours per night.
 * Returns a non-negative number: 0 = no debt (>= target),
 * positive = under-slept.
 */
export function sleepDebtHrsFromSleepRange(sleepJson, now = dayjs()) {
  const sleepArr = Array.isArray(sleepJson?.sleep) ? sleepJson.sleep : [];
  if (!sleepArr.length) return null;

  const mainSleeps = sleepArr.filter((s) =>
    typeof s.isMainSleep === "boolean" ? s.isMainSleep : true
  );
  if (!mainSleeps.length) return null;

  const byEndTime = [...mainSleeps].sort(
    (a, b) => dayjs(a.endTime).valueOf() - dayjs(b.endTime).valueOf()
  );

  const recent = byEndTime
    .filter((s) => dayjs(s.endTime).isBefore(now))
    .slice(-3); // last up to 3 nights

  if (!recent.length) return null;

  const hours = recent.map((s) => {
    const durMs = s.duration || 0;
    return durMs / (1000 * 60 * 60);
  });

  const avgHrs = hours.reduce((acc, v) => acc + v, 0) / hours.length;

  const target = 8;
  const debt = target - avgHrs;
  return debt > 0 ? debt : 0;
}

/**
 * recoveryIndex: combines RHR trend + sleep debt.
 *
 * Inputs:
 *  - restingHR7dTrend: (today RHR - avg previous 6 days), already computed
 *  - sleepDebtHrs: from sleepDebtHrsFromSleepRange
 *
 * Higher score == better recovery:
 *  - falling RHR (negative trend) -> boosts score
 *  - low sleep debt -> boosts score
 *  - rising RHR and high debt -> lower / negative score
 */
export function recoveryIndexFromSignals({ restingHR7dTrend, sleepDebtHrs }) {
  if (restingHR7dTrend == null && sleepDebtHrs == null) {
    return null;
  }

  const rhrTerm = typeof restingHR7dTrend === "number" ? -restingHR7dTrend : 0;
  const sleepTerm = typeof sleepDebtHrs === "number" ? -sleepDebtHrs : 0;

  // Simple unweighted sum for now (can tune weights later).
  return rhrTerm + sleepTerm;
}
