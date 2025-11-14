import fetch from "node-fetch";
import dayjs from "dayjs";
import { config } from "../../config/index.js";

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
