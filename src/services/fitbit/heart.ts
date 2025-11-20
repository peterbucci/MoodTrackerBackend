import fetch from "node-fetch";

type HrvIntradayPoint = {
  time: string | null;
  rmssd: number | null;
  coverage: number | null;
  hf: number | null;
  lf: number | null;
};

/**
 * Heart rate intraday at 1-minute resolution for a given date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/heart/date/2025-11-19/1d/1min.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-heart": [ ... ],
 *   "activities-heart-intraday": {
 *     "dataset": [ { "time": "00:00:00", "value": 70 }, ... ],
 *     ...
 *   }
 * }
 *
 * Normalized return:
 *   Array<{ time: string; hr: number | null }>
 */
export async function fetchHeartIntraday(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateISO}/1d/1min.json`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok)
    throw new Error(`HeartIntraday HTTP ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  const dataset = j["activities-heart-intraday"]?.dataset || [];
  return dataset.map((d: any) => ({
    time: `${dateISO}T${d.time}:00`,
    hr: d.value ? Number(d.value) : null,
  }));
}

/**
 * 7-day resting heart rate series ending at a date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/activities/heart/date/2025-11-19/7d.json"
 *
 * Raw response shape (simplified):
 * {
 *   "activities-heart": [
 *     {
 *       "dateTime": "2025-11-13",
 *       "value": {
 *         "restingHeartRate": 60,
 *         ...
 *       }
 *     },
 *     ...
 *   ]
 * }
 */
export async function fetchRestingHr7d(
  accessToken: string,
  endDateISO: string
) {
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
 * Daily HRV summary (rmssd) for a single date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/hrv/date/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "hrv": [
 *     {
 *       "dateTime": "2025-11-19",
 *       "value": {
 *         "dailyRmssd": 29.121,
 *         "deepRmssd": 28.962,
 *         ...
 *       }
 *     }
 *   ]
 * }
 */
export async function fetchHrvDaily(accessToken: string, dateISO: string) {
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
 * HRV summary over a date range.
 *
 * cURL:
  curl -H "Authorization: Bearer $FITBIT_TOKEN" \
       -H "Accept: application/json" \
       "https://api.fitbit.com/1/user/-/hrv/date/2025-11-12/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "hrv": [
 *     {
 *       "dateTime": "2025-11-12",
 *       "value": { "dailyRmssd": ..., "deepRmssd": ..., ... }
 *     },
 *     ...
 *   ]
 * }
 */
export async function fetchHrvRange(
  accessToken: string,
  startDateISO: string,
  endDateISO: string
) {
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
 * HRV intraday segments (rmssd, lf, hf, coverage) for a date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/hrv/date/2025-11-19/all.json"
 *
 * Raw response shape (simplified):
 * {
 *   "hrv": [
 *     {
 *       "dateTime": "2025-11-19",
 *       "minutes": [
 *         {
 *           "minute": "2025-11-19T00:20:00.000",
 *           "value": { "rmssd": 17.296, "coverage": 0.914, "hf": 64.208, "lf": 373.505 }
 *         },
 *         ...
 *       ]
 *     }
 *   ]
 * }
 *
 * Normalized return:
 *   Array<{ time: string; rmssd: number | null; coverage: number | null; hf: number | null; lf: number | null }>
 */
export async function fetchHrvIntraday(
  accessToken: string,
  dateISO: string
): Promise<HrvIntradayPoint[]> {
  const url = `https://api.fitbit.com/1/user/-/hrv/date/${dateISO}/all.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`HRVIntraday HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();
  const arr: any[] = Array.isArray(j.hrv) ? j.hrv : [];

  const dayEntry: any =
    arr.find((e: any) => e.dateTime === dateISO) || arr[0] || null;

  const minutes: any[] = Array.isArray(dayEntry?.minutes)
    ? dayEntry.minutes
    : [];

  return minutes
    .map<HrvIntradayPoint>((m: any) => ({
      time: m.minute || null, // already full ISO-ish timestamp
      rmssd: m.value?.rmssd ?? null,
      coverage: m.value?.coverage ?? null,
      hf: m.value?.hf ?? null,
      lf: m.value?.lf ?? null,
    }))
    .filter((p: HrvIntradayPoint) => p.time !== null);
}
