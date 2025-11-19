/**
 * This is the JSON shape stored in features.data (stringified).
 * - All numeric features are number | null (null = unavailable)
 * - Categorical/string features are string | null
 * - Boolean flags are boolean
 *
 * Tiers:
 *  - T1: direct Fitbit outputs or trivial aggregates (core signals)
 *  - T2: simple derived stats (slopes, stddev, deviations)
 *  - T3: 7-day baselines and deltas
 *  - T4: composite "psychophysiological" scores / flags
 *  - T5+: more experimental / higher-order combos (you can add later)
 */
export interface FeatureVectorV1 {
  /** Always include to version the schema in the DB. */
  version: 1;

  // ───────────────────────────────
  // ACTIVITY / STEPS (INTRADAY + DAILY)
  // ───────────────────────────────
  // T1 – raw-ish
  stepsLast5m: number | null; // sum of steps in last 5 minutes
  stepsLast15m: number | null; // last 15 minutes
  stepsLast60m: number | null; // last 60 minutes
  stepsTotalDay: number | null; // total steps for the calendar day
  sedentaryMinutesToday: number | null;
  lightMinutesToday: number | null;
  moderateMinutesToday: number | null;
  vigorousMinutesToday: number | null;

  // T2 – short-term dynamics
  stepsSlope60m: number | null; // slope of steps vs time (1h window)
  stepsStdDev60m: number | null; // variability of movement last hour

  // T3 – baselines & deviations
  steps7dAvg: number | null; // average daily steps over last 7 days
  stepsDeviationFrom7dAvg: number | null; // today - 7dAvg

  // ───────────────────────────────
  // HEART RATE (INTRADAY + RESTING HR)
  // ───────────────────────────────
  // T1
  hrNow: number | null; // most recent HR reading
  hrLast5mAvg: number | null;
  hrLast15mAvg: number | null;
  hrLast60mAvg: number | null;

  restingHrToday: number | null; // from activities/heart date summary
  restingHr7dAvg: number | null; // avg RHR from last 7 days

  // T2
  hrSlope60m: number | null; // trend of HR last 60m
  hrStdDev60m: number | null; // variability of HR last 60m

  // T3
  restingHrDeviationFrom7d: number | null; // todayRHR - rhr7dAvg

  // ───────────────────────────────
  // ACTIVE ZONE MINUTES (AZM)
  // from /activities/active-zone-minutes/...
  // ───────────────────────────────
  // T1
  azmTotalDay: number | null; // total AZM minutes today
  azmLast60m: number | null; // AZM minutes in last 60m

  // these come from either daily summary or your activity log list
  azmFatBurnMinutes: number | null; // total minutes in Fat Burn zone
  azmCardioMinutes: number | null; // total minutes in Cardio zone
  azmPeakMinutes: number | null; // total minutes in Peak zone

  // T2
  azmCardioToFatBurnRatio: number | null; // cardioMinutes / (fatBurn + 1e-6)
  azmLongestStreakMinutes: number | null; // longest continuous stretch with AZM>0

  // ───────────────────────────────
  // HRV – DAILY SUMMARY
  // from /hrv/date/{date}.json
  // ───────────────────────────────
  // T1
  hrvRmssdDaily: number | null; // value.dailyRmssd
  hrvDeepRmssdDaily: number | null; // value.deepRmssd (if present)

  // T3
  hrvRmssd7dAvg: number | null; // rolling avg of dailyRmssd over 7 days
  hrvRmssdDeviationFrom7d: number | null; // dailyRmssd - hrvRmssd7dAvg

  // ───────────────────────────────
  // HRV – INTRADAY (SLEEP)
  // from /hrv/date/{date}/all.json
  // ───────────────────────────────
  // T1 intraday aggregates
  hrvIntradayRmssdMean: number | null;
  hrvIntradayRmssdStdDev: number | null;
  hrvIntradayLfMean: number | null;
  hrvIntradayHfMean: number | null;
  hrvIntradayLfHfRatioMean: number | null;
  hrvIntradayCoverageMean: number | null;

  // ───────────────────────────────
  // BREATHING RATE (BR)
  // from /br/date/{date}/all.json
  // ───────────────────────────────
  // T1
  brFullNight: number | null; // fullSleepSummary.breathingRate
  brDeepSleep: number | null; // deepSleepSummary.breathingRate
  brRemSleep: number | null; // remSleepSummary.breathingRate
  brLightSleep: number | null; // lightSleepSummary.breathingRate

  // T3
  brFullNight7dAvg: number | null;
  brFullNightDeviationFrom7d: number | null;

  // ───────────────────────────────
  // SpO2 (OXYGEN SATURATION)
  // from /spo2/date/{date}.json
  // ───────────────────────────────
  // T1
  spo2Avg: number | null;
  spo2Min: number | null;
  spo2Max: number | null;

  // T2
  spo2Range: number | null; // spo2Max - spo2Min

  // T3
  spo2Avg7dAvg: number | null; // baseline avg over last 7 days
  spo2AvgDeviationFrom7d: number | null;

  // ───────────────────────────────
  // TEMPERATURE – SKIN
  // from /temp/skin/date/...
  // ───────────────────────────────
  // T1
  tempSkinNightlyRelative: number | null; // nightlyRelative for this date

  // T3
  tempSkinNightlyRelative7dAvg: number | null;
  tempSkinNightlyRelativeDeviationFrom7d: number | null;

  // ───────────────────────────────
  // SLEEP (7-DAY RANGE API)
  // from /sleep/date/{start}/{end}.json
  // ───────────────────────────────
  // T1 – for the anchor night closest to anchorMs/dateStr
  totalSleepMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  timeInBedMinutes: number | null;
  awakeningsCount: number | null;
  sleepEfficiencyPercent: number | null; // totalSleep / timeInBed * 100

  sleepOnsetLocalHour: number | null; // 0–23, local time
  wakeTimeLocalHour: number | null; // 0–23, local time

  // T3 – multi-night
  totalSleepMinutes7dAvg: number | null;
  sleepDebtHours7d: number | null; // target (e.g., 8h * 7) - totalSleepLast7d

  // T2/T3 convenience
  timeSinceWakeHours: number | null; // anchor - wake time in hours

  // ───────────────────────────────
  // EXERCISE (MOST RECENT LOG)
  // from /activities/list.json
  // ───────────────────────────────
  // T1
  lastExerciseType: string | null; // e.g. "Spinning"
  lastExerciseStartTime: string | null; // ISO string
  lastExerciseDurationMinutes: number | null;
  lastExerciseSteps: number | null;
  lastExerciseCalories: number | null;
  lastExerciseAvgHr: number | null;

  lastExerciseAzmTotal: number | null; // activeZoneMinutes.totalMinutes
  lastExerciseAzmFatBurn: number | null; // sum of minutesInHeartRateZones FAT_BURN
  lastExerciseAzmCardio: number | null; // CARDIO
  lastExerciseAzmPeak: number | null; // PEAK

  // T2
  lastExerciseIntensityScore: number | null; // some mix of avg HR, AZM, duration
  hoursSinceLastExercise: number | null;

  // ───────────────────────────────
  // NUTRITION
  // from /foods/log/date/{date}.json and /foods/log/water/date/{date}.json
  // ───────────────────────────────
  // T1
  totalCaloriesIntake: number | null;
  totalCarbsGrams: number | null;
  totalFatGrams: number | null;
  totalFiberGrams: number | null;
  totalProteinGrams: number | null;
  totalSodiumMg: number | null;
  totalWaterMl: number | null;
  mealsLoggedCount: number | null;

  // T2
  caloriesPerMealAvg: number | null;
  timeSinceLastMealHours: number | null; // if you infer from logDate/time

  // ───────────────────────────────
  // CONTEXT / GEO / TIME / WEATHER (from your own stack)
  // ───────────────────────────────
  // T1
  localHourOfDay: number | null; // 0–23
  localDayOfWeek: number | null; // 0=Sunday .. 6=Saturday
  isWeekend: boolean | null;

  lat: number | null;
  lon: number | null;
  locationClusterId: string | null; // e.g., "home", "campus", etc.

  weatherTempF: number | null;
  weatherFeelsLikeF: number | null;
  weatherPrecipMm: number | null;
  outdoorAqi: number | null;

  // ───────────────────────────────
  // HIGHER-LEVEL COMPOSITE FEATURES (FLAGS / SCORES)
  // ───────────────────────────────
  // These are optional but nice for downstream interpretability.
  // T4
  overexertionFlag: boolean | null; // high AZM + low sleep + high HR
  stressSpikeFlag: boolean | null; // HR up + HRV down + steps up
  eveningRestlessnessScore: number | null; // activity after ~22:00
  morningLethargyScore: number | null; // low steps + high HR early morning
  doomscrollingScore: number | null; // low steps, high phone use, etc (when you add phone features)
  sleepFragmentationScore: number | null; // ctr of awakenings vs total sleep
  recoveryScore: number | null; // composite function of HRV + RHR + temp + BR

  // Can always add more Tier 5+ experimental features later.
}
