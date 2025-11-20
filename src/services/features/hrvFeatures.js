/**
 * HRV feature extraction.
 *
 * Inputs:
 *  - hrvDailyJson:
 *      Raw JSON from Fitbit /1/user/-/hrv/date/[date].json
 *      Shape (simplified):
 *        {
 *          "hrv": [
 *            {
 *              "dateTime": "2025-11-19",
 *              "value": {
 *                "dailyRmssd": 28.5,
 *                "deepRmssd": 35.1,
 *                ...
 *              }
 *            }
 *          ]
 *        }
 *
 *  - hrvRangeJson:
 *      Raw JSON from Fitbit /1/user/-/hrv/date/[startDate]/[endDate].json
 *      Same shape, but "hrv" has multiple days.
 *
 *  - hrvIntradaySeries:
 *      Normalized array from fetchHrvIntraday(), where each point is:
 *        {
 *          time: string,        // ISO-like timestamp
 *          rmssd: number|null,
 *          coverage: number|null,
 *          hf: number|null,
 *          lf: number|null
 *        }
 *
 * Output features:
 *  - hrvRmssdDaily
 *  - hrvDeepRmssdDaily
 *  - hrvRmssd7dAvg
 *  - hrvRmssdDeviationFrom7d
 *  - hrvIntradayRmssdMean
 *  - hrvIntradayRmssdStdDev
 *  - hrvIntradayLfMean
 *  - hrvIntradayHfMean
 *  - hrvIntradayLfHfRatioMean
 *  - hrvIntradayCoverageMean
 */

/**
 * Compute mean of an array of numbers; returns null if empty.
 */
function mean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const sum = arr.reduce((acc, v) => acc + v, 0);
  return sum / arr.length;
}

/**
 * Compute population standard deviation of an array of numbers.
 * Returns null if fewer than 2 samples.
 */
function stdDev(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const m = mean(arr);
  if (m == null) return null;
  let sumSq = 0;
  for (const v of arr) {
    const d = v - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / arr.length);
}

/**
 * Extract dailyRmssd / deepRmssd from a single-day HRV JSON.
 */
function extractDailyFromSingleDay(hrvDailyJson) {
  const arr = Array.isArray(hrvDailyJson?.hrv) ? hrvDailyJson.hrv : [];
  if (arr.length === 0) {
    return { dailyRmssd: null, deepRmssd: null };
  }

  const v = arr[0]?.value || {};
  const dailyRmssd = typeof v.dailyRmssd === "number" ? v.dailyRmssd : null;
  const deepRmssd = typeof v.deepRmssd === "number" ? v.deepRmssd : null;

  return { dailyRmssd, deepRmssd };
}

/**
 * Compute average dailyRmssd over a range (e.g. last 7 days).
 */
function computeRmssdAvgFromRange(hrvRangeJson) {
  const arr = Array.isArray(hrvRangeJson?.hrv) ? hrvRangeJson.hrv : [];
  const vals = arr
    .map((e) => e?.value?.dailyRmssd)
    .filter((x) => typeof x === "number");

  if (vals.length === 0) return null;
  return mean(vals);
}

/**
 * Compute aggregate metrics from intraday HRV series.
 */
function intradayAggregates(hrvIntradaySeries) {
  const pts = Array.isArray(hrvIntradaySeries) ? hrvIntradaySeries : [];

  const rmssdVals = [];
  const lfVals = [];
  const hfVals = [];
  const covVals = [];
  const ratioVals = [];

  for (const p of pts) {
    const rmssd = typeof p.rmssd === "number" ? p.rmssd : null;
    const lf = typeof p.lf === "number" ? p.lf : null;
    const hf = typeof p.hf === "number" ? p.hf : null;
    const cov = typeof p.coverage === "number" ? p.coverage : null;

    if (rmssd != null) rmssdVals.push(rmssd);
    if (lf != null) lfVals.push(lf);
    if (hf != null) hfVals.push(hf);
    if (cov != null) covVals.push(cov);

    if (lf != null && hf != null && hf > 0) {
      ratioVals.push(lf / hf);
    }
  }

  return {
    hrvIntradayRmssdMean: mean(rmssdVals),
    hrvIntradayRmssdStdDev: stdDev(rmssdVals),
    hrvIntradayLfMean: mean(lfVals),
    hrvIntradayHfMean: mean(hfVals),
    hrvIntradayLfHfRatioMean: mean(ratioVals),
    hrvIntradayCoverageMean: mean(covVals),
  };
}

/**
 * Main HRV feature builder.
 *
 * @param {*} hrvDailyJson   Raw JSON from /hrv/date/[date].json
 * @param {*} hrvRangeJson   Raw JSON from /hrv/date/[start]/[end].json (e.g., 7d window)
 * @param {*} hrvIntradaySeries Array from fetchHrvIntraday()
 */
export function featuresFromHrv(hrvDailyJson, hrvRangeJson, hrvIntradaySeries) {
  // --- Daily & 7d baseline ---
  const { dailyRmssd, deepRmssd } = extractDailyFromSingleDay(hrvDailyJson);
  const rmssd7dAvg = computeRmssdAvgFromRange(hrvRangeJson);

  let rmssdDeviationFrom7d = null;
  if (dailyRmssd != null && rmssd7dAvg != null) {
    rmssdDeviationFrom7d = dailyRmssd - rmssd7dAvg;
  }

  // --- Intraday aggregates ---
  const intra = intradayAggregates(hrvIntradaySeries);

  return {
    // daily
    hrvRmssdDaily: dailyRmssd,
    hrvDeepRmssdDaily: deepRmssd,

    // 7d baseline
    hrvRmssd7dAvg: rmssd7dAvg,
    hrvRmssdDeviationFrom7d: rmssdDeviationFrom7d,

    // intraday aggregates
    hrvIntradayRmssdMean: intra.hrvIntradayRmssdMean,
    hrvIntradayRmssdStdDev: intra.hrvIntradayRmssdStdDev,
    hrvIntradayLfMean: intra.hrvIntradayLfMean,
    hrvIntradayHfMean: intra.hrvIntradayHfMean,
    hrvIntradayLfHfRatioMean: intra.hrvIntradayLfHfRatioMean,
    hrvIntradayCoverageMean: intra.hrvIntradayCoverageMean,
  };
}
