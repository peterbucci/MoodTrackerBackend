import fetch from "node-fetch";
import dayjs from "dayjs";

export async function fetchStepsIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Steps HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const series = (j["activities-steps-intraday"]?.dataset || []).map((d) => ({
    time: `${dateISO}T${d.time}:00`,
    steps: d.value ? Number(d.value) : 0,
  }));
  return series;
}

export async function fetchHeartIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`HeartIntraday HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const dataset = j["activities-heart-intraday"]?.dataset || [];
  return dataset.map((d) => ({
    time: `${dateISO}T${d.time}:00`,
    hr: d.value ? Number(d.value) : null,
  }));
}

export async function fetchDailySummary(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/activities/date/${dateISO}.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`DailySummary HTTP ${r.status}: ${await r.text()}`);
  return r.json(); // { summary: {...}, ... }
}

export async function fetchCaloriesIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`CaloriesIntraday HTTP ${r.status}: ${await r.text()}`);
  return r.json(); // { "activities-calories-intraday": { dataset: [...] } }
}

export async function fetchMostRecentExercise(accessToken, dateISO) {
  // Most recent activity before or on this date
  const url = `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${dateISO}&sort=desc&offset=0&limit=1`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`ExerciseList HTTP ${r.status}: ${await r.text()}`);
  return r.json(); // { activities: [ { startTime, duration, ... } ] }
}

export async function fetchSleepRange(accessToken, endDateISO, days = 7) {
  // Fitbit sleep range: /1.2/user/-/sleep/date/[start]/[end].json
  const end = dayjs(endDateISO);
  const start = end.subtract(days - 1, "day").format("YYYY-MM-DD");
  const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${start}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`Sleep HTTP ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

export async function fetchRestingHr7d(accessToken, endDateISO) {
  // Fitbit: /1/user/-/activities/heart/date/[date]/7d.json
  const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${endDateISO}/7d.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`RHR7d HTTP ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

/**
 * 7-day daily steps timeseries ending on endDateISO.
 * Shape: { "activities-steps": [ { dateTime: "YYYY-MM-DD", value: "1234" }, ... ] }
 */
export async function fetchSteps7d(accessToken, endDateISO) {
  // Fitbit: /1/user/-/activities/steps/date/[date]/7d.json
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${endDateISO}/7d.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`Steps7d HTTP ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

/**
 * Fetch Active Zone Minutes intraday for a given date at 1min resolution.
 * Shape (roughly):
 * {
 *   "activities-active-zone-minutes": [... daily summary ...],
 *   "activities-active-zone-minutes-intraday": {
 *      "dataset": [
 *        { "time": "00:00:00", "value": { "activeZoneMinutes": 0, "fatBurn": 0, "cardio": 0, "peak": 0 } },
 *        ...
 *      ]
 *   }
 * }
 */
export async function fetchAzmIntraday(accessToken, dateISO) {
  // detail-level can be 1min, 5min, 15min; 1min is best for your use case
  const url = `https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${dateISO}/1d/1min.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`AZMIntraday HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  const dataset = j["activities-active-zone-minutes-intraday"]?.dataset || [];

  // Normalize to a simple array with a real timestamp + zone breakdown
  return dataset.map((d) => ({
    time: `${dateISO}T${d.time}`, // e.g. "2025-11-19T14:03:00"
    activeZoneMinutes: d.value?.activeZoneMinutes ?? 0,
    fatBurn: d.value?.fatBurn ?? 0,
    cardio: d.value?.cardio ?? 0,
    peak: d.value?.peak ?? 0,
  }));
}

/**
 * Fetch HRV summary for a single date.
 * Fitbit: GET /1/user/-/hrv/date/{date}.json
 * Shape:
 * {
 *   "hrv": [
 *     {
 *       "dateTime": "YYYY-MM-DD",
 *       "value": {
 *         "dailyRmssd": 35.2,
 *         "deepRmssd": 40.1,
 *         ...
 *       }
 *     }
 *   ]
 * }
 */
export async function fetchHrvDaily(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/hrv/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`HRVDaily HTTP ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

/**
 * Fetch HRV summary over a date range.
 * Fitbit: GET /1/user/-/hrv/date/{startDate}/{endDate}.json
 */
export async function fetchHrvRange(accessToken, startDateISO, endDateISO) {
  const url = `https://api.fitbit.com/1/user/-/hrv/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`HRVRange HTTP ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

/**
 * Fetch Breathing Rate intraday for a given date.
 * Fitbit: GET /1/user/-/br/date/{date}/all.json
 * Typical shape:
 * {
 *   "br": [
 *     {
 *       "dateTime": "YYYY-MM-DD",
 *       "value": {
 *         "breathingRate": 13.2,
 *         "breathingRateValues": [
 *           { "time": "01:23:45", "value": 13.1 },
 *           ...
 *         ]
 *       }
 *     }
 *   ]
 * }
 */
export async function fetchBreathingRateIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/br/date/${dateISO}/all.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`BreathingIntraday HTTP ${r.status}: ${await r.text()}`);
  }
  const j = await r.json();

  const dayEntry = Array.isArray(j.br)
    ? j.br.find((e) => e.dateTime === dateISO)
    : null;
  const values = dayEntry?.value?.breathingRateValues || [];

  // Normalize to a simple array with timestamp + breathingRate
  return values.map((v) => ({
    time: `${dateISO}T${v.time}`, // "YYYY-MM-DDTHH:mm:ss"
    breathingRate: v.value ?? null,
  }));
}
