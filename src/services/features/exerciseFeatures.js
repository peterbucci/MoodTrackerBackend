import dayjs from "dayjs";

/**
 * Compute time since last exercise in minutes.
 * @param {*} listJson - JSON from Fitbit API /activities/list endpoint
 * @param {*} now - current time as dayjs object
 * @returns minutes since last exercise, or null if no exercise found
 */
export function timeSinceLastExerciseMinFromList(listJson, now = dayjs()) {
  const last = listJson?.activities?.[0];
  if (!last) return null;
  const end = dayjs(last.startTime).add(last.duration || 0, "millisecond");
  return Math.max(0, now.diff(end, "minute"));
}

export function postExerciseWindow90mFromList(listJson, now = dayjs()) {
  const mins = timeSinceLastExerciseMinFromList(listJson, now);
  if (mins == null) return null;
  return mins <= 90;
}
