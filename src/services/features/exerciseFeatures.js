import dayjs from "dayjs";

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
