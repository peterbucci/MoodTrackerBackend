import fetch from "node-fetch";

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
