import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);

import { db } from "../src/db/index.js";
import { getAnyTokenRow } from "../src/db/queries/tokens.js";
import { getAccessToken } from "../src/services/fitbit/oauth.js";
import { fetchSleepRange } from "../src/services/fitbit/sleep.ts";
import { featuresFromSleepRange } from "../src/services/features/sleepFeatures.ts";

const LOCAL_TZ_NAME =
  typeof dayjs.tz === "function" ? dayjs.tz.guess() || undefined : undefined;

// Simple cache so we fetch once per date
const sleepCache = new Map();

async function getSleepForDate(dateStr, accessToken) {
  if (sleepCache.has(dateStr)) return sleepCache.get(dateStr);
  const data = await fetchSleepRange(accessToken, dateStr, 7);
  sleepCache.set(dateStr, data);
  return data;
}

async function main() {
  console.log("Backing up your DB first is recommended (copy data.sqlite).");

  const tokenRow = getAnyTokenRow.get();
  if (!tokenRow) throw new Error("No token found in DB.");
  const accessToken = await getAccessToken(tokenRow.userId);

  // Pull features and any clientFeatures/lat/lon from requests if present
  const rows = db
    .prepare(
      `
      SELECT f.id, f.userId, f.createdAt, f.data, r.clientFeatures
      FROM features f
      LEFT JOIN requests r ON r.featureId = f.id
    `
    )
    .all();

  const updateStmt = db.prepare(
    `UPDATE features SET data = @data WHERE id = @id AND userId = @userId`
  );

  for (const row of rows) {
    const anchor = dayjs(row.createdAt);
    const dateStr = anchor.format("YYYY-MM-DD");

    // Fetch 7d sleep window ending on this date
    const sleepJson = await getSleepForDate(dateStr, accessToken);

    // Recompute sleep features for this anchor
    const sleepFeats = featuresFromSleepRange(sleepJson, anchor, LOCAL_TZ_NAME);

    // Merge into existing payload
    let existing;
    try {
      existing = JSON.parse(row.data);
    } catch {
      console.warn(`Skipping ${row.id}: bad JSON`);
      continue;
    }

    const updated = { ...existing, ...sleepFeats };

    updateStmt.run({
      id: row.id,
      userId: row.userId,
      data: JSON.stringify(updated),
    });

    console.log(`Updated sleep fields for feature ${row.id}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
