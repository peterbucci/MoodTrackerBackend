import dayjs from "dayjs";

/**
 * Extract "last night" sleep + 7-day bedtime variability from the
 * combined sleep range.
 */
export function featuresFromSleepRange(sleepJson: any, now = dayjs()) {
  const sleepArr = Array.isArray(sleepJson?.sleep) ? sleepJson.sleep : [];
  const notes: string[] = [];

  if (!sleepArr.length) {
    notes.push("no_sleep_data_7d");
    return {
      sleepDurationLastNightHrs: null,
      sleepEfficiency: null,
      wasoMinutes: null,
      remRatio: null,
      deepRatio: null,
      bedtimeStdDev7d: null,
      sleepOnsetLocalHour: null,
      wakeTimeLocalHour: null,
      sleepFragmentationScore: null,
      notes,
    };
  }

  // Filter to "main" sleep sessions only if flag exists, else use all
  const mainSleeps = sleepArr.filter((s: any) =>
    typeof s.isMainSleep === "boolean" ? s.isMainSleep : true
  );

  const byEndTime = [...mainSleeps].sort(
    (a, b) => dayjs(a.endTime).valueOf() - dayjs(b.endTime).valueOf()
  );

  // "Last night" = last main sleep that ended before now
  let lastNight: any = null;
  for (const s of byEndTime) {
    if (dayjs(s.endTime).isBefore(now)) lastNight = s;
  }
  if (!lastNight) {
    notes.push("no_last_night_sleep");
  }

  let sleepDurationLastNightHrs: number | null = null;
  let sleepEfficiency: number | null = null;
  let wasoMinutes: number | null = null;
  let remRatio: number | null = null;
  let deepRatio: number | null = null;
  let sleepOnsetLocalHour: number | null = null;
  let wakeTimeLocalHour: number | null = null;
  let sleepFragmentationScore: number | null = null;

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

    // Sleep onset / wake time in local hours (e.g., 22.5 = 10:30pm)
    const start = dayjs(lastNight.startTime);
    const end = dayjs(lastNight.endTime);
    if (start.isValid()) {
      sleepOnsetLocalHour = start.hour() + start.minute() / 60;
    }
    if (end.isValid()) {
      wakeTimeLocalHour = end.hour() + end.minute() / 60;
    }

    // Ratios from levels.summary if present
    const levelsSummary = lastNight.levels?.summary || {};
    const rem = levelsSummary.rem?.minutes ?? null;
    const deep = levelsSummary.deep?.minutes ?? null;
    const totalStageMins =
      (levelsSummary.rem?.minutes || 0) +
      (levelsSummary.deep?.minutes || 0) +
      (levelsSummary.light?.minutes || 0);

    if (totalStageMins > 0) {
      remRatio = rem != null ? rem / totalStageMins : null;
      deepRatio = deep != null ? deep / totalStageMins : null;
    }

    // Simple fragmentation score: proportion of time awake during the sleep period (0–1)
    if (wasoMinutes != null) {
      let totalWindowMinutes: number | null = null;

      if (typeof lastNight.minutesAsleep === "number") {
        totalWindowMinutes = lastNight.minutesAsleep + wasoMinutes;
      } else if (durationMs > 0) {
        totalWindowMinutes = durationMs / (1000 * 60);
      }

      if (totalWindowMinutes && totalWindowMinutes > 0) {
        const ratio = wasoMinutes / totalWindowMinutes;
        sleepFragmentationScore = Math.min(1, Math.max(0, ratio));
      }
    }
  }

  // Bedtime std dev across 7 days (main sleeps)
  const bedtimes = byEndTime.map((s) => {
    const start = dayjs(s.startTime);
    // minutes since local midnight
    return start.hour() * 60 + start.minute();
  });

  let bedtimeStdDev7d: number | null = null;
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
    sleepOnsetLocalHour,
    wakeTimeLocalHour,
    sleepFragmentationScore,
    notes,
  };
}
