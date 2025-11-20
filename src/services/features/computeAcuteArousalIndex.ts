/**
 * Acute Arousal Index (0 → 10 scale)
 * Measures immediate sympathetic activation.
 *
 * Components:
 *   + HR reactivity (ΔHR, HR slope, HR Z)
 *   + Movement bursts (steps + AZM)
 *   - Sedentary inertia before activation
 *   - Suppressed shortly after exercise
 *   - Suppressed if very sleep-deprived
 */
export function computeAcuteArousalIndex({
  hrDelta5m,
  hrSlopeLast30m,
  hrZNow,
  stepBurst5m,
  stepsLast15m,
  zeroStreakMax60m,
  azmSpike30m,
  postExerciseWindow90m,
  sleepDurationLastNightHrs,
}: {
  hrDelta5m?: number | null;
  hrSlopeLast30m?: number | null;
  hrZNow?: number | null;
  stepBurst5m?: number | null;
  stepsLast15m?: number | null;
  zeroStreakMax60m?: number | null;
  azmSpike30m?: number | null;
  postExerciseWindow90m?: boolean | null;
  sleepDurationLastNightHrs?: number | null;
}) {
  // --------- 0. Guardrail: do we have any signal at all? ----------
  const hasHr = [hrDelta5m, hrSlopeLast30m, hrZNow].some(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  const hasMovement = [stepBurst5m, stepsLast15m, azmSpike30m].some(
    (v) => typeof v === "number" && Number.isFinite(v)
  );

  // If we have neither HR nor movement signals, this score is meaningless
  if (!hasHr && !hasMovement) {
    return null;
  }

  // Safe numeric fallbacks: 0 = “no contribution”, not “we know it’s zero”
  const hDelta = typeof hrDelta5m === "number" ? hrDelta5m : 0;
  const hSlope = typeof hrSlopeLast30m === "number" ? hrSlopeLast30m : 0;
  const hZ = typeof hrZNow === "number" ? hrZNow : 0;

  const sb = typeof stepBurst5m === "number" ? stepBurst5m : 0;
  const steps15 = typeof stepsLast15m === "number" ? stepsLast15m : 0;
  const az = typeof azmSpike30m === "number" ? azmSpike30m : 0;
  const zs =
    typeof zeroStreakMax60m === "number" && Number.isFinite(zeroStreakMax60m)
      ? zeroStreakMax60m
      : null;

  /* -----------------------------------
     HR Reactivity Component (0–4)
  ----------------------------------- */
  const hrComponent =
    1.2 * hDelta + // strong fast HR jumps
    30 * hSlope + // slope is usually tiny, multiply
    1.0 * hZ; // HR Z confirms sympathetic load

  /* -----------------------------------
     Movement Reactivity (0–4)
  ----------------------------------- */
  const movementComponent =
    0.015 * steps15 + // 1000 steps → +15
    0.5 * sb + // short burst detection
    1.0 * az; // strong AZM spike = strong arousal

  /* -----------------------------------
     Sedentary Inertia Penalty (0–2)
     Only if we actually have zs.
  ----------------------------------- */
  let sedentaryPenalty = 0;
  if (zs != null) {
    if (zs >= 45 && sb < 15 && hDelta < 5) {
      // very sedentary but no real activation = muted system
      sedentaryPenalty = -1.0;
    } else if (zs >= 45 && (sb > 30 || hDelta > 10)) {
      // big break from long sitting = large arousal
      sedentaryPenalty = +1.0;
    }
  }

  /* -----------------------------------
     Context Suppression
  ----------------------------------- */

  // Less meaningful if this is just post-exercise HR decay.
  let exerciseSuppress = 0;
  if (postExerciseWindow90m === true) {
    exerciseSuppress = -1.5;
  }

  // Very sleep-deprived → blunted autonomic reactivity.
  let sleepSuppress = 0;
  if (
    typeof sleepDurationLastNightHrs === "number" &&
    sleepDurationLastNightHrs < 6
  ) {
    sleepSuppress = -0.5;
  }

  /* -----------------------------------
     Final Combine
  ----------------------------------- */

  let score =
    hrComponent +
    movementComponent +
    sedentaryPenalty +
    exerciseSuppress +
    sleepSuppress;

  /* -----------------------------------
     Normalize to 0 → 10
  ----------------------------------- */
  if (score < 0) score = 0;
  if (score > 10) score = 10;

  return score;
}
