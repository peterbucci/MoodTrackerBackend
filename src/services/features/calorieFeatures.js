import dayjs from "dayjs";

export function caloriesOutLast3hFromIntraday(
  caloriesJson,
  dateISO,
  now = dayjs()
) {
  const dataset = caloriesJson?.["activities-calories-intraday"]?.dataset || [];
  const start = now.subtract(180, "minute");
  let s = 0;
  for (const d of dataset) {
    const t = dayjs(`${dateISO}T${d.time}:00`);
    if (t.isAfter(start) && !t.isAfter(now)) s += Number(d.value) || 0;
  }
  return s;
}
