import fetch from "node-fetch";
import dayjs from "dayjs";

/**
 * Sleep logs over a date range (typically last 7 days).
 *
 * cURL (7-day range ending 2025-11-19):
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1.2/user/-/sleep/date/2025-11-13/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "sleep": [
 *     {
 *       "dateOfSleep": "2025-11-18",
 *       "duration": 27000000,
 *       "startTime": "2025-11-18T23:30:00.000",
 *       "endTime": "2025-11-19T07:00:00.000",
 *       "levels": {
 *         "summary": {
 *           "deep": { "minutes": ... },
 *           "light": { "minutes": ... },
 *           "rem": { "minutes": ... },
 *           "wake": { "minutes": ... }
 *         },
 *         "data": [ ... ]
 *       },
 *       ...
 *     },
 *     ...
 *   ]
 * }
 */
export async function fetchSleepRange(
  accessToken: string,
  endDateISO: string,
  days = 7
) {
  const end = dayjs(endDateISO);
  const start = end.subtract(days - 1, "day").format("YYYY-MM-DD");
  const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${start}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`Sleep HTTP ${r.status}: ${await r.text()}`);
  }
  const body: any = await r.json();

  if (Array.isArray(body?.sleep)) {
    const totals = new Map<string, number>();
    for (const s of body.sleep) {
      if (s?.isMainSleep === false) continue; // ignore naps
      const minsAsleep =
        typeof s?.minutesAsleep === "number"
          ? s.minutesAsleep
          : s?.levels?.summary
          ? ["light", "deep", "rem"].reduce(
              (sum, k) => sum + (s.levels.summary[k]?.minutes || 0),
              0
            )
          : 0;
      const date = s?.dateOfSleep;
      if (!date || !minsAsleep) continue;
      totals.set(date, (totals.get(date) ?? 0) + minsAsleep);
    }
    totals.forEach((mins, date) => {
      console.log(`[sleep] date=${date} hoursAsleep=${(mins / 60).toFixed(2)}`);
    });
  }

  return body;
}

/**
 * Breathing rate (respiratory rate) intraday by sleep stage for a date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/br/date/2025-11-19/all.json"
 *
 * Raw response shape (simplified):
 * {
 *   "br": [
 *     {
 *       "dateTime": "2025-11-19",
 *       "value": {
 *         "deepSleepSummary":  { "breathingRate": 10.8 },
 *         "remSleepSummary":   { "breathingRate":  9.8 },
 *         "fullSleepSummary":  { "breathingRate": 10.8 },
 *         "lightSleepSummary": { "breathingRate": 10.8 }
 *       }
 *     }
 *   ]
 * }
 *
 * Normalized return:
 *   { date, brFull, brDeep, brRem, brLight }
 */
export async function fetchBreathingRateIntraday(
  accessToken: string,
  dateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/br/date/${dateISO}/all.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`BreathingIntraday HTTP ${r.status}: ${await r.text()}`);
  }
  const j: any = await r.json();

  const dayEntry = Array.isArray(j.br)
    ? j.br.find((e: any) => e.dateTime === dateISO)
    : null;

  const value = dayEntry?.value || {};

  return {
    date: dateISO,
    brFull: value.fullSleepSummary?.breathingRate ?? null,
    brDeep: value.deepSleepSummary?.breathingRate ?? null,
    brRem: value.remSleepSummary?.breathingRate ?? null,
    brLight: value.lightSleepSummary?.breathingRate ?? null,
  };
}

/**
 * Normalized result for breathing rate summary for a single date.
 */
export interface BrDaily {
  date: string;
  brFull?: number | null; // full night breathing rate
  brDeep?: number | null;
  brRem?: number | null;
  brLight?: number | null;
}

/**
 * Fetch breathing rate summary for a range of dates.
 */
export async function fetchBreathingRateRange(
  accessToken: string,
  startDateISO: string,
  endDateISO: string
): Promise<BrDaily[]> {
  const url = `https://api.fitbit.com/1/user/-/br/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`BreathingRateRange HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();

  // Fitbit returns: { br: [...] }
  const arr = Array.isArray(j.br) ? j.br : [];

  return arr.map((e: any) => ({
    date: e.dateTime,
    brFull: e.value?.breathingRate ?? null,
    brDeep: e.value?.deepSleepSummary?.breathingRate ?? null,
    brRem: e.value?.remSleepSummary?.breathingRate ?? null,
    brLight: e.value?.lightSleepSummary?.breathingRate ?? null,
  }));
}
