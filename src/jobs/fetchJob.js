import dayjs from "dayjs";
import { getAccessToken } from "../services/fitbit/oauth.js";
import { fetchStepsIntraday } from "../services/fitbit/api.js";
import { buildAllFeatures } from "../services/features/index.js";
import { insertFeature } from "../db/queries/features.js";
import { v4 as uuidv4 } from "uuid";

export async function runFetchForUser(userId) {
  try {
    const accessToken = await getAccessToken(userId);
    const today = dayjs().format("YYYY-MM-DD");
    const stepsSeries = await fetchStepsIntraday(accessToken, today);

    const feats = await buildAllFeatures({ stepsSeries, now: dayjs() });

    const rec = {
      id: uuidv4(),
      userId,
      createdAt: Date.now(),
      source: "subscription",
      data: JSON.stringify(feats),
    };
    insertFeature.run(rec);
    return { ok: true, id: rec.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
