import express from "express";
import { getAnyUser } from "../db/queries/tokens.js";
import {
  listDesktopFeatures,
  getDesktopFeature,
} from "../db/queries/desktop.js";

const router = express.Router();

function mapRowToFeature(row) {
  if (!row) return null;

  const context = {
    calendarBusyNow: row.calendarBusyNow,
    lastCalendarEventType: row.lastCalendarEventType,
    notificationBurst5m: row.notificationBurst5m,
    notificationCount60m: row.notificationCount60m,
    daylightNowFlag: row.daylightNowFlag,
    daylightMinsRemaining: row.daylightMinsRemaining,
    weatherTempF: row.weatherTempF,
    weatherFeelsLikeF: row.weatherFeelsLikeF,
    weatherPrecipMm: row.weatherPrecipMm,
    outdoorAQI: row.outdoorAQI,
    lat: row.lat,
    lon: row.lon,
  };

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    source: row.source,
    label: row.label_id
      ? {
          id: row.label_id,
          label: row.label,
          category: row.label_category,
          createdAt: row.label_created_at,
        }
      : null,
    context,
  };
}

router.get("/desktop/features", (req, res) => {
  const userRow = getAnyUser.get();
  if (!userRow) return res.status(404).json({ error: "no user" });

  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = listDesktopFeatures.all(userRow.userId, limit, offset);
  const features = rows.map(mapRowToFeature);

  return res.json({
    ok: true,
    userId: userRow.userId,
    count: features.length,
    features,
  });
});

router.get("/desktop/features/:id", (req, res) => {
  const userRow = getAnyUser.get();
  if (!userRow) return res.status(404).json({ error: "no user" });

  const featureId = req.params.id;
  if (!featureId) {
    return res.status(400).json({ ok: false, error: "missing feature id" });
  }

  const row = getDesktopFeature.get(featureId, userRow.userId);
  if (!row) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  const feature = mapRowToFeature(row);
  return res.json({ ok: true, feature });
});

export default router;
