import fetch from "node-fetch";

/**
 * Steps intraday at 1-minute resolution for a given date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/steps/date/2025-11-19/1d/1min.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-steps-intraday": {
 *     "dataset": [ { "time": "00:00:00", "value": 12 }, ... ],
 *     ...
 *   },
 *   "activities-steps": [ ... ]
 * }
 *
 * Normalized return:
 *   Array<{ time: string; steps: number }>
 */
export async function fetchStepsIntraday(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Steps HTTP ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  const series =
    j["activities-steps-intraday"]?.dataset?.map((d: any) => ({
      time: `${dateISO}T${d.time}:00`,
      steps: d.value ? Number(d.value) : 0,
    })) || [];
  return series;
}

/**
 * Daily activity summary for a date (steps, minutes, distance, etc.).
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/date/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities": [ ... ],
 *   "goals": { ... },
 *   "summary": {
 *     "steps": 12345,
 *     "caloriesOut": 2100,
 *     "distances": [ ... ],
 *     "sedentaryMinutes": ...,
 *     "lightlyActiveMinutes": ...,
 *     "fairlyActiveMinutes": ...,
 *     "veryActiveMinutes": ...
 *   }
 * }
 */
export async function fetchDailySummary(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/date/${dateISO}.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`DailySummary HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

/**
 * Calories intraday at 1-minute resolution for a given date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/calories/date/2025-11-19/1d/1min.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-calories": [ ... ],
 *   "activities-calories-intraday": {
 *     "dataset": [ { "time": "00:00:00", "value": 1.23 }, ... ],
 *     ...
 *   }
 * }
 *
 * Returned as raw JSON (you normalize where you derive features).
 */
export async function fetchCaloriesIntraday(
  accessToken: string,
  dateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`CaloriesIntraday HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

/**
 * Most recent logged activity before or on a given date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=2025-11-19&sort=desc&offset=0&limit=1"
 *
 * Raw response shape (simplified):
 * {
 *   "pagination": { ... },
 *   "activities": [
 *     {
 *       "logId": 4248...,
 *       "activityName": "Spinning",
 *       "calories": 215,
 *       "steps": 250,
 *       "averageHeartRate": 93,
 *       "duration": 1529000,
 *       "activeDuration": 1529000,
 *       "startTime": "2025-11-17T13:10:08.000-05:00",
 *       "heartRateZones": [ ... ],
 *       "activeZoneMinutes": {
 *         "totalMinutes": 8,
 *         "minutesInHeartRateZones": [ ... ]
 *       },
 *       ...
 *     }
 *   ]
 * }
 */
export async function fetchMostRecentExercise(
  accessToken: string,
  dateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${dateISO}&sort=desc&offset=0&limit=1`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`ExerciseList HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

/**
 * 7-day daily steps timeseries ending on endDateISO.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/steps/date/2025-11-19/7d.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-steps": [
 *     { "dateTime": "2025-11-13", "value": "1234" },
 *     ...
 *   ]
 * }
 */
export async function fetchSteps7d(accessToken: string, endDateISO: string) {
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
 * Active Zone Minutes intraday for a given date (1-minute detail).
 *
 * cURL:
 curl -H "Authorization: Bearer $FITBIT_TOKEN" \
       -H "Accept: application/json" \
        "https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/2025-11-19/1d/1min.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-active-zone-minutes-intraday": [
 *     {
 *       "dateTime": "2025-11-19",
 *       "minutes": [
 *         {
 *           "minute": "2025-11-19T00:00:00",
 *           "value": { "activeZoneMinutes": 0 }
 *         },
 *         ...
 *       ]
 *     }
 *   ]
 * }
 *
 * Normalized return:
 *   Array<{ time: string; activeZoneMinutes: number }>
 */
export async function fetchAzmIntraday(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${dateISO}/1d/1min.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`AZMIntraday HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();

  const intraday = j["activities-active-zone-minutes-intraday"];
  let minutes: any[] = [];

  if (Array.isArray(intraday) && intraday.length > 0) {
    minutes = Array.isArray(intraday[0].minutes) ? intraday[0].minutes : [];
  }

  return minutes
    .map((d) => ({
      time: d.minute || null,
      activeZoneMinutes:
        typeof d.value?.activeZoneMinutes === "number"
          ? d.value.activeZoneMinutes
          : null,

      fatBurnActiveZoneMinutes:
        typeof d.value?.fatBurnActiveZoneMinutes === "number"
          ? d.value.fatBurnActiveZoneMinutes
          : null,

      cardioActiveZoneMinutes:
        typeof d.value?.cardioActiveZoneMinutes === "number"
          ? d.value.cardioActiveZoneMinutes
          : null,
    }))
    .filter((p) => p.time !== null);
}
