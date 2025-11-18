import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import tzLookup from "tz-lookup";
import SunCalc from "suncalc";
import { config } from "../../config/index.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCATION_CLUSTERS = (() => {
  try {
    return JSON.parse(config.LOCATION_CLUSTERS);
  } catch {
    console.warn("Invalid LOCATION_CLUSTERS in .env; using empty array");
    return [];
  }
})();

// crude "distance" in degrees; good enough for clustering
function roughDistance2(lat1, lon1, lat2, lon2) {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return dLat * dLat + dLon * dLon;
}

function assignLocationCluster(lat, lon) {
  if (!Array.isArray(LOCATION_CLUSTERS) || LOCATION_CLUSTERS.length === 0) {
    return null;
  }
  let best = LOCATION_CLUSTERS[0];
  let bestD2 = roughDistance2(lat, lon, best.lat, best.lon);

  for (let i = 1; i < LOCATION_CLUSTERS.length; i++) {
    const c = LOCATION_CLUSTERS[i];
    const d2 = roughDistance2(lat, lon, c.lat, c.lon);
    if (d2 < bestD2) {
      best = c;
      bestD2 = d2;
    }
  }
  return best.key;
}

async function fetchWeatherAndAqi(lat, lon) {
  try {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m` +
      `&temperature_unit=fahrenheit` +
      `&wind_speed_unit=mph` +
      `&precipitation_unit=mm` +
      `&timezone=auto`;

    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=us_aqi` +
      `&timezone=auto`;

    const [weatherRes, airRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airUrl),
    ]);

    if (!weatherRes.ok) {
      throw new Error(`OpenMeteo weather HTTP ${weatherRes.status}`);
    }

    const weatherJson = await weatherRes.json();
    const c = weatherJson.current;
    if (!c) return {};

    const tempF = c.temperature_2m ?? null;
    const windMph = c.wind_speed_10m ?? 0;
    const humidity = c.relative_humidity_2m ?? 0;
    const precipMm = c.precipitation ?? null;

    // --- Feels-like calc (heat index / wind chill) ---
    let feelsLikeF = tempF;
    if (tempF !== null) {
      // Heat index
      if (tempF >= 80 && humidity >= 40) {
        const T = tempF;
        const RH = humidity;
        feelsLikeF =
          -42.379 +
          2.04901523 * T +
          10.14333127 * RH -
          0.22475541 * T * RH -
          0.00683783 * T * T -
          0.05481717 * RH * RH +
          0.00122874 * T * T * RH +
          0.00085282 * T * RH * RH -
          0.00000199 * T * T * RH * RH;
      }

      // Wind chill
      if (tempF <= 50 && windMph >= 3) {
        feelsLikeF =
          35.74 +
          0.6215 * tempF -
          35.75 * Math.pow(windMph, 0.16) +
          0.4275 * tempF * Math.pow(windMph, 0.16);
      }
    }

    // --- AQI ---
    let outdoorAQI = null;
    if (airRes.ok) {
      try {
        const airJson = await airRes.json();
        const hours = airJson.hourly?.time;
        const aqiArr = airJson.hourly?.us_aqi;

        if (
          Array.isArray(hours) &&
          Array.isArray(aqiArr) &&
          hours.length &&
          aqiArr.length
        ) {
          const now = Date.now();
          let bestIdx = 0;
          let bestDiff = Infinity;

          for (let i = 0; i < hours.length; i++) {
            const t = Date.parse(hours[i]);
            if (Number.isNaN(t)) continue;
            const diff = Math.abs(t - now);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
          }

          outdoorAQI = aqiArr[bestIdx] ?? null;
        }
      } catch (err) {
        console.warn("Open-Meteo air-quality parse failed:", err);
      }
    } else {
      console.warn(`OpenMeteo AQI HTTP ${airRes.status}`);
    }

    return {
      weatherTempF: tempF,
      weatherFeelsLikeF: feelsLikeF,
      weatherPrecipMm: precipMm,
      outdoorAQI,
    };
  } catch (err) {
    console.warn("Open-Meteo weather/AQI fetch failed:", err);
    return {};
  }
}

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

  // 3) Location cluster + one-hot
  const clusterKey = assignLocationCluster(lat, lon);
  const locationClusterOneHot = {};
  if (clusterKey) {
    for (const c of LOCATION_CLUSTERS) {
      const featKey = `locationClusterOneHot_${c.key}`;
      locationClusterOneHot[featKey] = c.key === clusterKey ? 1 : 0;
    }
  }

  // 4) Commute flag heuristic
  let commuteFlag = 0;
  if (clusterKey) {
    const isHome = clusterKey.toLowerCase().includes("home");
    const onCampus = clusterKey.toLowerCase().includes("campus");
    const inMorningCommute = hourOfDay >= 14 && hourOfDay <= 16;
    const inEveningCommute = hourOfDay >= 17 && hourOfDay <= 20;

    if (
      !isHome &&
      !onCampus(inMorningCommute || inEveningCommute) &&
      dayOfWeek > 4
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
