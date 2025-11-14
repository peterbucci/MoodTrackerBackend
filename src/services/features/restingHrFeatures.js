export function restingHr7dTrendFromSeries(rhrJson) {
  const arr = Array.isArray(rhrJson?.["activities-heart"])
    ? rhrJson["activities-heart"]
    : [];

  // Extract raw RHR values
  const values = arr
    .map((e) => e?.value?.restingHeartRate)
    .filter((v) => typeof v === "number");

  if (values.length < 2) return null;

  const today = values[values.length - 1];
  const prev6 = values.slice(0, -1);

  const avgPrev = prev6.reduce((a, b) => a + b, 0) / prev6.length;

  // Positive = RHR rising (bad recovery)
  // Negative = RHR falling (good recovery)
  return today - avgPrev;
}
