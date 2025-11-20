export interface TempSkinDaily {
  date?: string;
  tempSkinNightlyRelative?: number | null;
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
 * Build skin temperature features:
 * - tempSkinNightlyRelative                 (current night)
 * - tempSkinNightlyRelative7dAvg            (baseline avg over history, if provided)
 * - tempSkinNightlyRelativeDeviationFrom7d  (current − baseline)
 *
 * @param tempDaily   normalized single-day tempSkin summary
 * @param tempHistory optional history array for baseline, same normalized shape
 */
export function featuresFromTempSkin(
  tempDaily: TempSkinDaily | null | undefined,
  tempHistory?: TempSkinDaily[] | null
) {
  const current =
    typeof tempDaily?.tempSkinNightlyRelative === "number" &&
    Number.isFinite(tempDaily.tempSkinNightlyRelative)
      ? tempDaily.tempSkinNightlyRelative
      : null;

  const hist = Array.isArray(tempHistory) ? tempHistory : [];

  const vals: number[] = hist
    .map((d) => d?.tempSkinNightlyRelative)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const tempSkinNightlyRelative7dAvg = mean(vals); // reuse your mean()

  const tempSkinNightlyRelativeDeviationFrom7d =
    current != null && tempSkinNightlyRelative7dAvg != null
      ? current - tempSkinNightlyRelative7dAvg
      : null;

  return {
    tempSkinNightlyRelative: current,
    tempSkinNightlyRelative7dAvg,
    tempSkinNightlyRelativeDeviationFrom7d,
  };
}
