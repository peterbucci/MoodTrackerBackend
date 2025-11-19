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

export async function fetchAzmIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${dateISO}/1d/1min.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    throw new Error(`AZMIntraday HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();

  // Shape is:
  // {
  //   "activities-active-zone-minutes-intraday": [
  //     {
  //       "minutes": [
  //         { "value": { "activeZoneMinutes": 0 }, "minute": "2025-11-19T00:00:00" },
  //         ...
  //       ],
  //       "dateTime": "2025-11-19"
  //     }
  //   ]
  // }
  const intraday = j["activities-active-zone-minutes-intraday"];
  let minutes = [];

  if (Array.isArray(intraday) && intraday.length > 0) {
    minutes = Array.isArray(intraday[0].minutes) ? intraday[0].minutes : [];
  }

  // Normalize
  return minutes
    .map((d) => ({
      time: d.minute || null,
      activeZoneMinutes: d.value?.activeZoneMinutes ?? 0,
    }))
    .filter((p) => p.time !== null);
}

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

  const value = dayEntry?.value || {};

  // Return a single summary object instead of a time series
  return {
    date: dateISO,
    brFull: value.fullSleepSummary?.breathingRate ?? null,
    brDeep: value.deepSleepSummary?.breathingRate ?? null,
    brRem: value.remSleepSummary?.breathingRate ?? null,
    brLight: value.lightSleepSummary?.breathingRate ?? null,
  };
}

export async function fetchSpo2Daily(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/spo2/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`Spo2Daily HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  // j = { dateTime, value: { avg, min, max } }

  return {
    date: j.dateTime || dateISO,
    spo2Avg: j.value?.avg ?? null,
    spo2Min: j.value?.min ?? null,
    spo2Max: j.value?.max ?? null,
  };
}

export async function fetchSpo2Range(accessToken, startDateISO, endDateISO) {
  const url = `https://api.fitbit.com/1/user/-/spo2/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`Spo2Range HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  // j = [ { dateTime, value: { avg, min, max } }, ... ]

  const arr = Array.isArray(j) ? j : [];

  return arr.map((e) => ({
    date: e.dateTime,
    spo2Avg: e.value?.avg ?? null,
    spo2Min: e.value?.min ?? null,
    spo2Max: e.value?.max ?? null,
  }));
}

export async function fetchTempSkinDaily(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/temp/skin/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`TempSkinDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  const arr = Array.isArray(j.tempSkin) ? j.tempSkin : [];

  // Find the entry for this date (there should usually be at most one)
  const entry = arr.find((e) => e.dateTime === dateISO) || arr[0] || null;

  const nightlyRelative = entry?.value?.nightlyRelative ?? null;

  return {
    date: dateISO,
    tempSkinNightlyRelative: nightlyRelative,
    logType: entry?.logType ?? null,
  };
}

export async function fetchTempSkinRange(
  accessToken,
  startDateISO,
  endDateISO
) {
  const url = `https://api.fitbit.com/1/user/-/temp/skin/date/${startDateISO}/${endDateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`TempSkinRange HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  const arr = Array.isArray(j.tempSkin) ? j.tempSkin : [];

  return arr.map((e) => ({
    date: e.dateTime,
    tempSkinNightlyRelative: e.value?.nightlyRelative ?? null,
    logType: e.logType ?? null,
  }));
}

export async function fetchNutritionDaily(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/foods/log/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`NutritionDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();

  const foods = Array.isArray(j.foods) ? j.foods : [];
  const summary = j.summary || {};

  const normalizedFoods = foods.map((f) => ({
    logId: f.logId ?? null,
    logDate: f.logDate ?? null,
    name: f.loggedFood?.name ?? null,
    brand: f.loggedFood?.brand ?? null,
    calories: f.nutritionalValues?.calories ?? null,
    carbs: f.nutritionalValues?.carbs ?? null,
    fat: f.nutritionalValues?.fat ?? null,
    fiber: f.nutritionalValues?.fiber ?? null,
    protein: f.nutritionalValues?.protein ?? null,
    sodium: f.nutritionalValues?.sodium ?? null,
    amount: f.loggedFood?.amount ?? null,
    unitId: f.loggedFood?.unit?.id ?? null,
    unitName: f.loggedFood?.unit?.name ?? null,
    mealTypeId: f.loggedFood?.mealTypeId ?? null,
  }));

  return {
    date: dateISO,
    foods: normalizedFoods,
    nutritionSummary: {
      calories: summary.calories ?? 0,
      carbs: summary.carbs ?? 0,
      fat: summary.fat ?? 0,
      fiber: summary.fiber ?? 0,
      protein: summary.protein ?? 0,
      sodium: summary.sodium ?? 0,
      water: summary.water ?? 0, // ml-ish
    },
  };
}

export async function fetchWaterDaily(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/foods/log/water/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`WaterDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();

  const waterLogs = Array.isArray(j.water) ? j.water : [];
  const summary = j.summary || {};

  const normalizedLogs = waterLogs.map((w) => ({
    logId: w.logId ?? null,
    amount: w.amount ?? null,
    unit: w.unit ?? null,
    logDate: w.logDate ?? dateISO,
  }));

  return {
    date: dateISO,
    waterLogs: normalizedLogs,
    waterTotal: summary.water ?? 0,
  };
}

export async function fetchHrvIntraday(accessToken, dateISO) {
  const url = `https://api.fitbit.com/1/user/-/hrv/date/${dateISO}/all.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`HRVIntraday HTTP ${r.status}: ${await r.text()}`);
  }

  const j = await r.json();
  const arr = Array.isArray(j.hrv) ? j.hrv : [];

  const dayEntry = arr.find((e) => e.dateTime === dateISO) || arr[0] || null;

  const minutes = Array.isArray(dayEntry?.minutes) ? dayEntry.minutes : [];

  return minutes
    .map((m) => ({
      time: m.minute || null, // already full ISO-ish timestamp
      rmssd: m.value?.rmssd ?? null,
      coverage: m.value?.coverage ?? null,
      hf: m.value?.hf ?? null,
      lf: m.value?.lf ?? null,
    }))
    .filter((p) => p.time !== null);
}
