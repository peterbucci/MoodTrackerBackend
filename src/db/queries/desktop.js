import { desktopDb } from "../index.js";

export const insertFeatureDesktop = desktopDb.prepare(`
  INSERT INTO features (id, user_id, created_at, source)
  VALUES (@id, @user_id, @created_at, @source)
`);

export const insertLabelDesktop = desktopDb.prepare(`
  INSERT INTO labels (id, user_id, label, category, created_at)
  VALUES (@id, @user_id, @label, @category, @created_at)
`);

export const linkFeatureLabelDesktop = desktopDb.prepare(`
  INSERT INTO feature_labels (feature_id, label_id)
  VALUES (@feature_id, @label_id)
  ON CONFLICT(feature_id) DO UPDATE SET label_id = excluded.label_id
`);

export const upsertFeatureContextDesktop = desktopDb.prepare(`
  INSERT INTO feature_context (
    feature_id,
    calendarBusyNow,
    lastCalendarEventType,
    notificationBurst5m,
    notificationCount60m,
    daylightNowFlag,
    daylightMinsRemaining,
    weatherTempF,
    weatherFeelsLikeF,
    weatherPrecipMm,
    outdoorAQI,
    lat,
    lon
  )
  VALUES (
    @feature_id,
    @calendarBusyNow,
    @lastCalendarEventType,
    @notificationBurst5m,
    @notificationCount60m,
    @daylightNowFlag,
    @daylightMinsRemaining,
    @weatherTempF,
    @weatherFeelsLikeF,
    @weatherPrecipMm,
    @outdoorAQI,
    @lat,
    @lon
  )
  ON CONFLICT(feature_id) DO UPDATE SET
    calendarBusyNow = excluded.calendarBusyNow,
    lastCalendarEventType = excluded.lastCalendarEventType,
    notificationBurst5m = excluded.notificationBurst5m,
    notificationCount60m = excluded.notificationCount60m,
    daylightNowFlag = excluded.daylightNowFlag,
    daylightMinsRemaining = excluded.daylightMinsRemaining,
    weatherTempF = excluded.weatherTempF,
    weatherFeelsLikeF = excluded.weatherFeelsLikeF,
    weatherPrecipMm = excluded.weatherPrecipMm,
    outdoorAQI = excluded.outdoorAQI,
    lat = excluded.lat,
    lon = excluded.lon
`);

export const listDesktopFeatures = desktopDb.prepare(`
  SELECT
    f.id,
    f.user_id,
    f.created_at,
    f.source,
    l.id AS label_id,
    l.label AS label,
    l.category AS label_category,
    l.created_at AS label_created_at,
    fc.calendarBusyNow,
    fc.lastCalendarEventType,
    fc.notificationBurst5m,
    fc.notificationCount60m,
    fc.daylightNowFlag,
    fc.daylightMinsRemaining,
    fc.weatherTempF,
    fc.weatherFeelsLikeF,
    fc.weatherPrecipMm,
    fc.outdoorAQI,
    fc.lat,
    fc.lon
  FROM features f
  LEFT JOIN feature_labels fl ON fl.feature_id = f.id
  LEFT JOIN labels l ON l.id = fl.label_id AND l.user_id = f.user_id
  LEFT JOIN feature_context fc ON fc.feature_id = f.id
  WHERE f.user_id = ?
  ORDER BY f.created_at DESC
  LIMIT ?
  OFFSET ?
`);

export const getDesktopFeature = desktopDb.prepare(`
  SELECT
    f.id,
    f.user_id,
    f.created_at,
    f.source,
    l.id AS label_id,
    l.label AS label,
    l.category AS label_category,
    l.created_at AS label_created_at,
    fc.calendarBusyNow,
    fc.lastCalendarEventType,
    fc.notificationBurst5m,
    fc.notificationCount60m,
    fc.daylightNowFlag,
    fc.daylightMinsRemaining,
    fc.weatherTempF,
    fc.weatherFeelsLikeF,
    fc.weatherPrecipMm,
    fc.outdoorAQI,
    fc.lat,
    fc.lon
  FROM features f
  LEFT JOIN feature_labels fl ON fl.feature_id = f.id
  LEFT JOIN labels l ON l.id = fl.label_id AND l.user_id = f.user_id
  LEFT JOIN feature_context fc ON fc.feature_id = f.id
  WHERE f.id = ? AND f.user_id = ?
`);
