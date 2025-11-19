import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import tzLookup from "tz-lookup";
import SunCalc from "suncalc";

import {
  assignLocationCluster,
  buildLocationClusterOneHot,
} from "./locationClusters.js";
import { fetchWeatherAndAqi } from "./weather.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Build geo/time/daylight/cluster/weather features from lat/lon + anchor time.
 */
export async function buildGeoAndTimeFeatures({ lat, lon, anchor }) {
  if (
    typeof lat !== "number" ||
    Number.isNaN(lat) ||
    typeof lon !== "number" ||
    Number.isNaN(lon)
  ) {
    return {};
  }

  // 1) Timezone + local time
  let tz = "UTC";
  try {
    tz = tzLookup(lat, lon);
  } catch (err) {
    console.warn("tz-lookup failed, falling back to UTC:", err);
  }

  const local = dayjs(anchor).tz(tz);

  const hourOfDay = local.hour();
  const dayOfWeek = local.day(); // 0 = Sun
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 2) Daylight info
  const dateObj = local.toDate();
  const sunTimes = SunCalc.getTimes(dateObj, lat, lon);
  const sunrise = dayjs(sunTimes.sunrise).tz(tz);
  const sunset = dayjs(sunTimes.sunset).tz(tz);

  const daylightNowFlag =
    local.isAfter(sunrise) && local.isBefore(sunset) ? 1 : 0;

  const daylightMinsRemaining = daylightNowFlag
    ? Math.max(0, sunset.diff(local, "minute"))
    : 0;

  // 3) Location cluster + one-hot (using bubble-based cluster assignment)
  const clusterKey = assignLocationCluster(lat, lon);
  const locationClusterOneHot = buildLocationClusterOneHot(clusterKey);

  // 4) Commute flag heuristic
  let commuteFlag = 0;
  if (clusterKey) {
    const keyLower = clusterKey.toLowerCase();
    const isHome = keyLower.includes("home");
    const onCampus = keyLower.includes("campus");
    const inMorningCommute = hourOfDay >= 14 && hourOfDay <= 16;
    const inEveningCommute = hourOfDay >= 17 && hourOfDay <= 20;

    if (
      !isHome &&
      !onCampus &&
      (inMorningCommute || inEveningCommute) &&
      dayOfWeek < 5 &&
      dayOfWeek > 0
    ) {
      commuteFlag = 1;
    }
  }

  // 5) Weather + AQI
  const weatherFeats = await fetchWeatherAndAqi(lat, lon);

  return {
    hourOfDay,
    dayOfWeek,
    isWeekend,
    daylightNowFlag,
    daylightMinsRemaining,
    locationClusterKey: clusterKey || null,
    commuteFlag,
    ...locationClusterOneHot,
    ...weatherFeats,
  };
}
