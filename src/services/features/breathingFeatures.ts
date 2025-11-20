export interface BreathingDaily {
  date?: string;
  brFull?: number | null;
  brDeep?: number | null;
  brRem?: number | null;
  brLight?: number | null;
}

/**
 * Simple helper: mean of numeric array, or null if empty.
 */
function mean(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Build breathing-rate features:
 * - brFullNight         (current night)
 * - brDeepSleep         (current night, deep)
 * - brRemSleep          (current night, REM)
 * - brLightSleep        (current night, light)
 * - brFullNight7dAvg    (baseline avg over history, if provided)
 * - brFullNightDeviationFrom7d (current − baseline)
 *
 * @param brDaily   normalized single-day BR summary
 * @param brHistory optional history array for baseline, same normalized shape
 */
export function featuresFromBreathing(
  brDaily: BreathingDaily | null | undefined,
  brHistory?: BreathingDaily[] | null
) {
  const brFull =
    typeof brDaily?.brFull === "number" && Number.isFinite(brDaily.brFull)
      ? brDaily.brFull
      : null;
  const brDeep =
    typeof brDaily?.brDeep === "number" && Number.isFinite(brDaily.brDeep)
      ? brDaily.brDeep
      : null;
  const brRem =
    typeof brDaily?.brRem === "number" && Number.isFinite(brDaily.brRem)
      ? brDaily.brRem
      : null;
  const brLight =
    typeof brDaily?.brLight === "number" && Number.isFinite(brDaily.brLight)
      ? brDaily.brLight
      : null;

  const hist = Array.isArray(brHistory) ? brHistory : [];

  const fullVals: number[] = hist
    .map((d) => d?.brFull)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const brFullNight7dAvg = mean(fullVals);

  const brFullNightDeviationFrom7d =
    brFull != null && brFullNight7dAvg != null
      ? brFull - brFullNight7dAvg
      : null;

  return {
    // current night
    brFullNight: brFull,
    brDeepSleep: brDeep,
    brRemSleep: brRem,
    brLightSleep: brLight,

    // baseline + deviation
    brFullNight7dAvg,
    brFullNightDeviationFrom7d,
  };
}
