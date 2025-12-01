/**
 * Parse a time string into minutes since midnight.
 * @param {*} timeStr - time string in various formats
 * @returns minutes since midnight
 */
export function parseTimeToMinutes(timeStr) {
  const s = String(timeStr).trim(); // ensure it's a string and trim whitespace

  let h = 0;
  let m = 0;
  let sec = 0;

  // Check for ISO 8601 format with 'T' separator
  if (s.length >= 19 && s[10] === "T") {
    // Looks like "YYYY-MM-DDTHH:mm:ss..."
    const clock = s.slice(11, 19); // "HH:mm:ss"
    const parts = clock.split(":"); // [HH, mm, ss]
    h = parseInt(parts[0] || "0", 10) || 0;
    m = parseInt(parts[1] || "0", 10) || 0;
    sec = parseInt(parts[2] || "0", 10) || 0;
  } else {
    // Plain "HH:mm" or "HH:mm:ss"
    const parts = s.split(":"); // [HH, mm, ss]
    h = parseInt(parts[0] || "0", 10) || 0;
    m = parseInt(parts[1] || "0", 10) || 0;
    sec = parts[2] ? parseInt(parts[2], 10) || 0 : 0;
  }

  return h * 60 + m + sec / 60; // total minutes since midnight
}

/**
 * Compute minutes since midnight from a dayjs object.
 * @param {*} now - dayjs object representing current time
 * @returns minutes since midnight
 */
export function minutesSinceMidnight(now) {
  return now.hour() * 60 + now.minute() + now.second() / 60;
}

export function normalizeMinutesForWindow(tM, nowM) {
  if (!Number.isFinite(tM)) return null;

  // If the intraday point's clock time is "later today" than `now`,
  // treat it as belonging to the previous calendar day.
  // This lets rolling windows like "last 60 minutes" cross midnight.
  if (tM > nowM) {
    return tM - 1440; // shift into previous day
  }
  return tM;
}
