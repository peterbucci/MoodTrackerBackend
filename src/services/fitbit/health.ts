// fitbit/health.ts
import fetch from "node-fetch";

/**
 * Night SpO₂ summary for a single date (avg/min/max).
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/spo2/date/2025-11-19.json"
 *
 * Raw response shape:
 * {
 *   "dateTime": "2025-11-19",
 *   "value": { "avg": 94.9, "min": 90.8, "max": 99 }
 * }
 *
 * Normalized return:
 *   { date, spo2Avg, spo2Min, spo2Max }
 */
export async function fetchSpo2Daily(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/spo2/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`Spo2Daily HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();

  return {
    date: j.dateTime || dateISO,
    spo2Avg: j.value?.avg ?? null,
    spo2Min: j.value?.min ?? null,
    spo2Max: j.value?.max ?? null,
  };
}

/**
 * SpO₂ summary over a date range (array of avg/min/max per night).
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/spo2/date/2025-11-12/2025-11-19.json"
 *
 * Raw response shape:
 * [
 *   { "dateTime": "2025-11-12", "value": { "avg": 94.2, "max": 96.6, "min": 91.2 } },
 *   ...
 * ]
 *
 * Normalized return:
 *   Array<{ date, spo2Avg, spo2Min, spo2Max }>
 */
export async function fetchSpo2Range(
  accessToken: string,
  startDateISO: string,
  endDateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/spo2/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`Spo2Range HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();
  const arr = Array.isArray(j) ? j : [];

  return arr.map((e: any) => ({
    date: e.dateTime,
    spo2Avg: e.value?.avg ?? null,
    spo2Min: e.value?.min ?? null,
    spo2Max: e.value?.max ?? null,
  }));
}

/**
 * Skin temperature nightly relative value for a single date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/temp/skin/date/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "tempSkin": [
 *     {
 *       "dateTime": "2025-11-19",
 *       "logType": "dedicated_temp_sensor",
 *       "value": { "nightlyRelative": -0.9 }
 *     }
 *   ]
 * }
 *
 * Normalized return:
 *   { date, tempSkinNightlyRelative, logType }
 */
export async function fetchTempSkinDaily(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/temp/skin/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`TempSkinDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();
  const arr = Array.isArray(j.tempSkin) ? j.tempSkin : [];

  const entry = arr.find((e: any) => e.dateTime === dateISO) || arr[0] || null;

  const nightlyRelative = entry?.value?.nightlyRelative ?? null;

  return {
    date: dateISO,
    tempSkinNightlyRelative: nightlyRelative,
    logType: entry?.logType ?? null,
  };
}

/**
 * Skin temperature nightly relative values over a date range.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/temp/skin/date/2025-11-12/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "tempSkin": [
 *     {
 *       "dateTime": "2025-11-12",
 *       "logType": "dedicated_temp_sensor",
 *       "value": { "nightlyRelative": 0.1 }
 *     },
 *     ...
 *   ]
 * }
 *
 * Normalized return:
 *   Array<{ date, tempSkinNightlyRelative, logType }>
 */
export async function fetchTempSkinRange(
  accessToken: string,
  startDateISO: string,
  endDateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/temp/skin/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`TempSkinRange HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();
  const arr = Array.isArray(j.tempSkin) ? j.tempSkin : [];

  return arr.map((e: any) => ({
    date: e.dateTime,
    tempSkinNightlyRelative: e.value?.nightlyRelative ?? null,
    logType: e.logType ?? null,
  }));
}
