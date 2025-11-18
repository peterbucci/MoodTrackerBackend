import dayjs from "dayjs";

/**
 * Extract "last night" sleep + 7-day bedtime variability from the
 * combined sleep range.
 */
export function featuresFromSleepRange(sleepJson, now = dayjs()) {
  const sleepArr = Array.isArray(sleepJson?.sleep) ? sleepJson.sleep : [];
  const notes = [];

  if (!sleepArr.length) {
    notes.push("no_sleep_data_7d");
    return {
      sleepDurationLastNightHrs: null,
      sleepEfficiency: null,
      wasoMinutes: null,
      remRatio: null,
      deepRatio: null,
      bedtimeStdDev7d: null,
      notes,
    };
  }

  // Filter to "main" sleep sessions only if flag exists, else use all
  const mainSleeps = sleepArr.filter((s) =>
    typeof s.isMainSleep === "boolean" ? s.isMainSleep : true
  );

  const byEndTime = [...mainSleeps].sort(
    (a, b) => dayjs(a.endTime).valueOf() - dayjs(b.endTime).valueOf()
  );

  // "Last night" = last main sleep that ended before now
  let lastNight = null;
  for (const s of byEndTime) {
    if (dayjs(s.endTime).isBefore(now)) lastNight = s;
  }
  if (!lastNight) {
    notes.push("no_last_night_sleep");
  }

  let sleepDurationLastNightHrs = null;
  let sleepEfficiency = null;
  let wasoMinutes = null;
  let remRatio = null;
  let deepRatio = null;

  if (lastNight) {
    const durationMs = lastNight.duration || 0;
    sleepDurationLastNightHrs = durationMs / (1000 * 60 * 60);

    if (typeof lastNight.efficiency === "number") {
      sleepEfficiency = lastNight.efficiency;
    }

    // Use minutesAwake as a proxy for WASO
    if (typeof lastNight.minutesAwake === "number") {
      wasoMinutes = lastNight.minutesAwake;
    }

    // Ratios from levels.summary if present
    const levelsSummary = lastNight.levels?.summary || {};
    const rem = levelsSummary.rem?.minutes ?? null;
    const deep = levelsSummary.deep?.minutes ?? null;
    const totalMins =
      (levelsSummary.rem?.minutes || 0) +
      (levelsSummary.deep?.minutes || 0) +
      (levelsSummary.light?.minutes || 0);

    if (totalMins > 0) {
      remRatio = rem != null ? rem / totalMins : null;
      deepRatio = deep != null ? deep / totalMins : null;
    }
  }

  // Bedtime std dev across 7 days (main sleeps)
  const bedtimes = byEndTime.map((s) => {
    const start = dayjs(s.startTime);
    // minutes since local midnight
    return start.hour() * 60 + start.minute();
  });

  let bedtimeStdDev7d = null;
  if (bedtimes.length >= 2) {
    const mean = bedtimes.reduce((acc, v) => acc + v, 0) / bedtimes.length;
    const variance =
      bedtimes.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
      bedtimes.length;
    const stdMinutes = Math.sqrt(variance);
    bedtimeStdDev7d = stdMinutes / 60.0; // hours
  } else {
    notes.push("insufficient_sleep_nights_for_stddev");
  }

  return {
    sleepDurationLastNightHrs,
    sleepEfficiency,
    wasoMinutes,
    remRatio,
    deepRatio,
    bedtimeStdDev7d,
    notes,
  };
}
