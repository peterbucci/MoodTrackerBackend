export interface Spo2Daily {
  date?: string;
  spo2Avg?: number | null;
  spo2Min?: number | null;
  spo2Max?: number | null;
}

export type Spo2History = Spo2Daily[] | null | undefined;

/**
 * mean of numeric array, or null if empty.
 */
function mean(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Build SpO2 features:
 * - spo2Avg              (current night average)
 * - spo2Min              (current night minimum)
 * - spo2Max              (current night maximum)
 * - spo2Range            (max − min)
 * - spo2Avg7dAvg         (baseline avg over history)
 * - spo2AvgDeviationFrom7d (current avg − baseline avg)
 *
 * @param spo2Daily  normalized daily SpO2 (from fetchSpo2Daily)
 * @param spo2RangeJson normalized range array (from fetchSpo2Range), optional
 */
export function featuresFromSpo2(
  spo2Daily: Spo2Daily | null | undefined,
  spo2RangeJson?: Spo2History
) {
  const spo2Avg =
    typeof spo2Daily?.spo2Avg === "number" && Number.isFinite(spo2Daily.spo2Avg)
      ? spo2Daily.spo2Avg
      : null;

  const spo2Min =
    typeof spo2Daily?.spo2Min === "number" && Number.isFinite(spo2Daily.spo2Min)
      ? spo2Daily.spo2Min
      : null;

  const spo2Max =
    typeof spo2Daily?.spo2Max === "number" && Number.isFinite(spo2Daily.spo2Max)
      ? spo2Daily.spo2Max
      : null;

  const spo2Range =
    spo2Max != null && spo2Min != null ? spo2Max - spo2Min : null;

  const hist = Array.isArray(spo2RangeJson) ? spo2RangeJson : [];

  const avgVals: number[] = hist
    .map((d) => d?.spo2Avg)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const spo2Avg7dAvg = mean(avgVals);

  const spo2AvgDeviationFrom7d =
    spo2Avg != null && spo2Avg7dAvg != null ? spo2Avg - spo2Avg7dAvg : null;

  return {
    spo2Avg,
    spo2Min,
    spo2Max,
    spo2Range,
    spo2Avg7dAvg,
    spo2AvgDeviationFrom7d,
  };
}
