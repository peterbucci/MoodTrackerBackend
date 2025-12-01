import dayjs from "dayjs";
import {
  parseTimeToMinutes,
  minutesSinceMidnight,
} from "../../utils/timeUtils.js";

/**
 * Calculates calories out in the last 3 hours from intraday calories data.
 * @param {*} caloriesJson - Fitbit intraday calories JSON
 * @param {*} now - current time as dayjs object
 * @returns calories out in the last 3 hours
 */
export function caloriesOutLast3hFromIntraday(caloriesJson, now = dayjs()) {
  const dataset = caloriesJson?.["activities-calories-intraday"]?.dataset || [];

  const nowM = minutesSinceMidnight(now);
  const startM = nowM - 180;
  let s = 0;

  for (const d of dataset) {
    const raw = parseTimeToMinutes(d.time);
    const tM = normalizeMinutesForWindow(raw, nowM);
    if (tM == null) continue;
    if (tM > startM && tM <= nowM) {
      s += Number(d.value) || 0;
    }
  }

  return s;
}
