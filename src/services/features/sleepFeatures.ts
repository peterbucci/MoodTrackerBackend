import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

type SleepEntry = {
  dateOfSleep?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  isMainSleep?: boolean;
  minutesAsleep?: number;
  minutesAwake?: number;
  efficiency?: number;
  levels?: {
    summary?: {
      deep?: { minutes?: number };
      light?: { minutes?: number };
      rem?: { minutes?: number };
      wake?: { minutes?: number };
    };
  };
  [k: string]: any;
};

type NightAggregate = {
  date: string; // YYYY-MM-DD (night key)
  startTimes: dayjs.Dayjs[];
  endTimes: dayjs.Dayjs[];
  minutesAsleep: number;
  minutesAwake: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
};

/**
 * Extract “last night” sleep + 7-day bedtime variability from the
 * combined sleep range returned by fetchSleepRange(endDate, 7).
 *
 * Assumptions:
 * - sleepJson.sleep is the raw array from Fitbit’s /sleep/date/start/end.
 * - Each entry has dateOfSleep, startTime, endTime, minutesAsleep, etc.
 * - We treat multiple segments with the same dateOfSleep as one “night”.
 */
export function featuresFromSleepRange(
  sleepJson: any,
  now = dayjs(), // kept for signature compatibility; not used in selection
  tzNameOverride?: string | null
) {
  const sleepArr: SleepEntry[] = Array.isArray(sleepJson?.sleep)
    ? sleepJson.sleep
    : [];
  const notes: string[] = [];

  // Decide how to parse times:
  const hasExplicitTz =
    typeof tzNameOverride === "string" && tzNameOverride.trim().length > 0;
  const tzName = hasExplicitTz ? tzNameOverride!.trim() : undefined;

  const parseTime = (t: string) => {
    if (!t) return dayjs(NaN);
    if (hasExplicitTz && tzName) {
      return dayjs.tz(t, tzName);
    }
    return dayjs(t);
  };

  const isValidTime = (t?: string) =>
    typeof t === "string" && parseTime(t).isValid();

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

  // ------------------------------------------------------------
  // 1. Filter to "main" sleeps and aggregate by dateOfSleep
  // ------------------------------------------------------------
  const mainSleeps = sleepArr.filter((s) =>
    typeof s.isMainSleep === "boolean" ? s.isMainSleep : true
  );

  if (!mainSleeps.length) {
    notes.push("no_main_sleep_entries");
  }

  const nights = new Map<string, NightAggregate>();

  for (const s of mainSleeps) {
    const startValid = isValidTime(s.startTime);
    const endValid = isValidTime(s.endTime);
    if (!startValid || !endValid) continue;

    const start = parseTime(s.startTime!);
    const end = parseTime(s.endTime!);

    const nightDate =
      typeof s.dateOfSleep === "string" && s.dateOfSleep
        ? s.dateOfSleep
        : start.format("YYYY-MM-DD");

    const agg =
      nights.get(nightDate) ||
      ({
        date: nightDate,
        startTimes: [],
        endTimes: [],
        minutesAsleep: 0,
        minutesAwake: 0,
        deepMinutes: 0,
        lightMinutes: 0,
        remMinutes: 0,
      } as NightAggregate);

    agg.startTimes.push(start);
    agg.endTimes.push(end);

    // Minutes asleep: prefer minutesAsleep; else derive from levels.summary
    let minsAsleep = 0;
    if (typeof s.minutesAsleep === "number") {
      minsAsleep = s.minutesAsleep;
    } else if (s.levels?.summary) {
      const sum = s.levels.summary;
      minsAsleep =
        (sum.light?.minutes || 0) +
        (sum.deep?.minutes || 0) +
        (sum.rem?.minutes || 0);
    }
    agg.minutesAsleep += minsAsleep;

    // Minutes awake: prefer minutesAwake; else use wake minutes
    let minsAwake = 0;
    if (typeof s.minutesAwake === "number") {
      minsAwake = s.minutesAwake;
    } else if (s.levels?.summary?.wake?.minutes) {
      minsAwake = s.levels.summary.wake.minutes || 0;
    }
    agg.minutesAwake += minsAwake;

    // Stage minutes from levels.summary
    if (s.levels?.summary) {
      const sum = s.levels.summary;
      agg.deepMinutes += sum.deep?.minutes || 0;
      agg.lightMinutes += sum.light?.minutes || 0;
      agg.remMinutes += sum.rem?.minutes || 0;
    }

    nights.set(nightDate, agg);
  }

  const nightDates = Array.from(nights.keys()).sort(); // YYYY-MM-DD sort works lexicographically

  // ------------------------------------------------------------
  // 2. Pick "last night" = most recent night in the window
  // ------------------------------------------------------------
  let sleepDurationLastNightHrs: number | null = null;
  let sleepEfficiency: number | null = null;
  let wasoMinutes: number | null = null;
  let remRatio: number | null = null;
  let deepRatio: number | null = null;
  let sleepOnsetLocalHour: number | null = null;
  let wakeTimeLocalHour: number | null = null;
  let sleepFragmentationScore: number | null = null;

  if (nightDates.length > 0) {
    const lastNightDate = nightDates[nightDates.length - 1];
    const lastNight = nights.get(lastNightDate)!;

    const totalAsleep = lastNight.minutesAsleep;
    const totalAwake = lastNight.minutesAwake;
    const totalWindowMinutes =
      totalAsleep + totalAwake > 0 ? totalAsleep + totalAwake : 0;

    // Duration (hours) – match fetchSleepRange logging: total minutesAsleep per date
    sleepDurationLastNightHrs =
      totalAsleep > 0 ? totalAsleep / 60.0 : totalWindowMinutes / 60.0 || null;

    // Efficiency: asleep / (asleep + awake) * 100
    if (totalWindowMinutes > 0) {
      sleepEfficiency = (totalAsleep / totalWindowMinutes) * 100.0;
    }

    // WASO = total minutes awake during the night
    wasoMinutes = totalAwake > 0 ? totalAwake : null;

    // Onset / wake local hours
    if (lastNight.startTimes.length) {
      const earliestStart = lastNight.startTimes.reduce((min, d) =>
        d.isBefore(min) ? d : min
      );
      sleepOnsetLocalHour =
        earliestStart.hour() + earliestStart.minute() / 60.0;
    }

    if (lastNight.endTimes.length) {
      const latestEnd = lastNight.endTimes.reduce((max, d) =>
        d.isAfter(max) ? d : max
      );
      wakeTimeLocalHour = latestEnd.hour() + latestEnd.minute() / 60.0;
    }

    // Stage ratios
    const totalStageMins =
      lastNight.remMinutes + lastNight.deepMinutes + lastNight.lightMinutes;
    if (totalStageMins > 0) {
      remRatio =
        lastNight.remMinutes > 0 ? lastNight.remMinutes / totalStageMins : null;
      deepRatio =
        lastNight.deepMinutes > 0
          ? lastNight.deepMinutes / totalStageMins
          : null;
    }

    // Fragmentation score: proportion of awake time in the sleep window, clamped to [0,1]
    if (totalWindowMinutes > 0 && totalAwake > 0) {
      const ratio = totalAwake / totalWindowMinutes;
      sleepFragmentationScore = Math.min(1, Math.max(0, ratio));
    }
  } else {
    notes.push("no_night_aggregates");
  }

  // ------------------------------------------------------------
  // 3. Bedtime std dev across 7 days
  //    - Use earliest start per night
  //    - Normalize across midnight: hours < 12 → +24h
  // ------------------------------------------------------------
  const bedtimeMinutes: number[] = [];

  for (const date of nightDates) {
    const agg = nights.get(date)!;
    if (!agg.startTimes.length) continue;
    const earliestStart = agg.startTimes.reduce((min, d) =>
      d.isBefore(min) ? d : min
    );

    let mins = earliestStart.hour() * 60 + earliestStart.minute();

    // Normalize: true bedtimes in the early morning (00:30, etc.)
    // belong to "late night" of the previous day; push into [720, 2880).
    if (mins < 12 * 60) {
      mins += 24 * 60;
    }
    bedtimeMinutes.push(mins);
  }

  let bedtimeStdDev7d: number | null = null;
  if (bedtimeMinutes.length >= 2) {
    const mean =
      bedtimeMinutes.reduce((acc, v) => acc + v, 0) / bedtimeMinutes.length;
    const variance =
      bedtimeMinutes.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
      bedtimeMinutes.length;
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
