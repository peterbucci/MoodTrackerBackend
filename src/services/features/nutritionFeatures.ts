import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

/**
 * Shape returned by fetchNutritionDaily (normalized in fitbit/nutrition.ts).
 *
 * See: fetchNutritionDaily → returns { date, foods, nutritionSummary }
 */
export interface NutritionSummary {
  calories: number;
  carbs: number;
  fat: number;
  fiber: number;
  protein: number;
  sodium: number;
  water: number;
}

export interface NormalizedFoodLog {
  logId: number | string | null;
  logDate: string | null;
  name: string | null;
  brand: string | null;
  calories: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  protein: number | null;
  sodium: number | null;
  amount: number | null;
  unitId: number | null;
  unitName: string | null;
  mealTypeId: number | null;
  // If you later add a time field from Fitbit, put it here:
  logDateTime?: string | null;
}

export interface NutritionDailyNormalized {
  date: string;
  foods: NormalizedFoodLog[];
  nutritionSummary: NutritionSummary;
}

/**
 * Shape returned by fetchWaterDaily (normalized in fitbit/nutrition.ts).
 *
 * See: fetchWaterDaily → returns { date, waterLogs, waterTotal }
 */
export interface WaterLog {
  logId: number | string | null;
  amount: number | null;
  unit: string | null;
  logDate: string | null;
}

export interface WaterDailyNormalized {
  date: string;
  waterLogs: WaterLog[];
  waterTotal: number;
}

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

function safeNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Compute hours since last meal based on the most recent food log.
 *
 * NOTE: Fitbit's /foods/log/date endpoint only guarantees a date (logDate).
 * If you later add a more precise timestamp (e.g. logDateTime), this logic
 * will automatically start using it.
 */
export function timeSinceLastMealHoursFromFoods(
  foods: NormalizedFoodLog[],
  now: Dayjs = dayjs()
): number | null {
  if (!foods || foods.length === 0) return null;

  const candidates = foods
    .map((f) => f.logDateTime || f.logDate)
    .filter((ts): ts is string => typeof ts === "string")
    .map((ts) => dayjs(ts))
    .filter((d) => d.isValid());

  if (!candidates.length) return null;

  const lastMeal = candidates.reduce((latest, d) =>
    d.isAfter(latest) ? d : latest
  );

  const diffHours = now.diff(lastMeal, "hour", true);
  return diffHours >= 0 ? diffHours : 0;
}

/* ---------------------------------------------
   Main feature builder
--------------------------------------------- */

/**
 * Build Nutrition & Water features:
 *
 * - totalCaloriesIntake
 * - totalCarbsGrams
 * - totalFatGrams
 * - totalFiberGrams
 * - totalProteinGrams
 * - totalSodiumMg
 * - totalWaterMl
 * - mealsLoggedCount
 * - timeSinceLastMealHours
 *
 * @param nutritionDaily normalized result from fetchNutritionDaily(...)
 * @param waterDaily     normalized result from fetchWaterDaily(...) (optional)
 * @param now            current time (dayjs), used for timeSinceLastMealHours
 */
export function buildNutritionFeatureBlock(
  nutritionDaily: NutritionDailyNormalized | null | undefined,
  waterDaily?: WaterDailyNormalized | null,
  now: Dayjs = dayjs()
) {
  const foods = nutritionDaily?.foods ?? [];
  const summary = nutritionDaily?.nutritionSummary;

  const totalCaloriesIntake = safeNumber(summary?.calories);
  const totalCarbsGrams = safeNumber(summary?.carbs);
  const totalFatGrams = safeNumber(summary?.fat);
  const totalFiberGrams = safeNumber(summary?.fiber);
  const totalProteinGrams = safeNumber(summary?.protein);
  const totalSodiumMg = safeNumber(summary?.sodium);

  // Prefer waterDaily.waterTotal if available, else fallback to summary.water
  const waterFromDaily = safeNumber(waterDaily?.waterTotal);
  const waterFromSummary = safeNumber(summary?.water);
  const totalWaterMl = waterFromDaily ?? waterFromSummary;

  // Count meals: number of distinct mealTypeId's used that day;
  // if they’re all null, fall back to number of food logs.
  let mealsLoggedCount: number | null = null;
  if (foods.length > 0) {
    const mealTypeIds = new Set(
      foods
        .map((f) => f.mealTypeId)
        .filter((id): id is number => typeof id === "number")
    );
    if (mealTypeIds.size > 0) {
      mealsLoggedCount = mealTypeIds.size;
    } else {
      mealsLoggedCount = foods.length;
    }
  }

  const timeSinceLastMealHours = timeSinceLastMealHoursFromFoods(foods, now);

  return {
    totalCaloriesIntake,
    totalCarbsGrams,
    totalFatGrams,
    totalFiberGrams,
    totalProteinGrams,
    totalSodiumMg,
    totalWaterMl,
    mealsLoggedCount,
    timeSinceLastMealHours,
  };
}
