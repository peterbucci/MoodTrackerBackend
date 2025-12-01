import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Extract "last night" sleep + 7-day bedtime variability from the
 * combined sleep range.
 */
export function featuresFromSleepRange(
  sleepJson: any,
  now = dayjs(),
  tzNameOverride?: string | null
) {
  const sleepArr = Array.isArray(sleepJson?.sleep) ? sleepJson.sleep : [];
  const notes: string[] = [];

  // Decide how to parse times:
  // - If we have an explicit tzNameOverride string, use that.
  // - Otherwise, let dayjs parse the string as-is (including any offset).
  const hasExplicitTz =
    typeof tzNameOverride === "string" && tzNameOverride.trim().length > 0;
  const tzName = hasExplicitTz ? tzNameOverride!.trim() : undefined;

  const parseTime = (t: string) => {
    if (hasExplicitTz && tzName) {
      return dayjs.tz(t, tzName);
    }
    return dayjs(t);
  };

  const isValidTime = (t: string) => {
    const d = parseTime(t);
    return d.isValid();
  };

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

  const byEndTime = [...mainSleeps]
    .filter((s) => s?.endTime && isValidTime(s.endTime))
    .sort(
      (a, b) => parseTime(a.endTime).valueOf() - parseTime(b.endTime).valueOf()
    );

  // "Last night" = last main sleep that ended at or before `now`
  let lastNight: any = null;
  const candidates = byEndTime.filter((s) => {
    const end = parseTime(s.endTime);
    return end.isBefore(now) || end.isSame(now);
  });

  if (candidates.length) {
    lastNight = candidates[candidates.length - 1];
  } else if (byEndTime.length) {
    // Fallback: if none ended before "now", take the latest main sleep available.
    // This is a rare edge-case (e.g. future-dated data); it should not apply to normal logs.
    lastNight = byEndTime[byEndTime.length - 1];
    notes.push("used_latest_sleep_fallback");
  } else {
    notes.push("no_last_night_sleep");
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
    sleepDurationLastNightHrs =
      durationMs > 0 ? durationMs / (1000 * 60 * 60) : null;

    if (typeof lastNight.efficiency === "number") {
      sleepEfficiency = lastNight.efficiency;
    }

    // Use minutesAwake as a proxy for WASO
    if (typeof lastNight.minutesAwake === "number") {
      wasoMinutes = lastNight.minutesAwake;
    }

    // Sleep onset / wake time in local hours (e.g., 22.5 = 10:30pm)
    const start = parseTime(lastNight.startTime);
    const end = parseTime(lastNight.endTime);
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
    const start = parseTime(s.startTime);
    if (!start.isValid()) return null;

    // Minutes since local midnight
    let mins = start.hour() * 60 + start.minute();

    // Normalize across midnight:
    // for "true" bedtimes, anything in the early morning (e.g. 00:30)
    // is really "late night" of the previous day. Treat hours < 12 as +24h.
    if (mins < 12 * 60) {
      mins += 24 * 60; // push into [720, 2880)
    }

    return mins;
  });

  let bedtimeStdDev7d: number | null = null;
  const validBedtimes = bedtimes.filter((v) => v != null) as number[];
  if (validBedtimes.length >= 2) {
    const mean =
      validBedtimes.reduce((acc, v) => acc + v, 0) / validBedtimes.length;
    const variance =
      validBedtimes.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
      validBedtimes.length;
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
