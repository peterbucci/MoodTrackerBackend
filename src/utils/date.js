export function timeOnSameDay(now, timeStr) {
  // p.time is "HH:mm:ss"
  const [h, m, s] = timeStr.split(":").map((n) => parseInt(n, 10) || 0);
  // dayjs is immutable, this returns a *new* dayjs, doesn't mutate now
  return now.hour(h).minute(m).second(s).millisecond(0);
}
