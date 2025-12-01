import fetch from "node-fetch";

/**
 * Food logs + nutrition summary for a date.
 *
 * cURL:
    curl -H "Authorization: Bearer $FITBIT_TOKEN" \
         -H "Accept: application/json" \
        "https://api.fitbit.com/1/user/-/foods/log/date/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "foods": [
 *     {
 *       "logId": 3762...,
 *       "logDate": "2025-11-19",
 *       "loggedFood": {
 *         "name": "Chocolate Toffee Cookies",
 *         "amount": 13.5,
 *         "unit": { "id": 147, "name": "gram" },
 *         "mealTypeId": 4,
 *         ...
 *       },
 *       "nutritionalValues": {
 *         "calories": 70,
 *         "carbs": 8,
 *         "fat": 3.5,
 *         "fiber": 0.5,
 *         "protein": 1,
 *         "sodium": 75
 *       }
 *     },
 *     ...
 *   ],
 *   "summary": {
 *     "calories": ...,
 *     "carbs": ...,
 *     "fat": ...,
 *     "fiber": ...,
 *     "protein": ...,
 *     "sodium": ...,
 *     "water": ...
 *   }
 * }
 *
 * Normalized return:
 *   { date, foods: [...], nutritionSummary: {...} }
 */
export async function fetchNutritionDaily(
  accessToken: string,
  dateISO: string
) {
  const url = `https://api.fitbit.com/1/user/-/foods/log/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`NutritionDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();

  const foods = Array.isArray(j.foods) ? j.foods : [];
  const summary = j.summary || {};

  const normalizedFoods = foods.map((f: any) => ({
    logId: f.logId ?? null,
    logDate: f.logDate ?? null,
    name: f.loggedFood?.name ?? null,
    brand: f.loggedFood?.brand ?? null,
    calories: f.nutritionalValues?.calories ?? null,
    carbs: f.nutritionalValues?.carbs ?? null,
    fat: f.nutritionalValues?.fat ?? null,
    fiber: f.nutritionalValues?.fiber ?? null,
    protein: f.nutritionalValues?.protein ?? null,
    sodium: f.nutritionalValues?.sodium ?? null,
    amount: f.loggedFood?.amount ?? null,
    unitId: f.loggedFood?.unit?.id ?? null,
    unitName: f.loggedFood?.unit?.name ?? null,
    mealTypeId: f.loggedFood?.mealTypeId ?? null,
  }));

  const toNumOrNull = (v: any): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  return {
    date: dateISO,
    foods: normalizedFoods,
    nutritionSummary: {
      calories: toNumOrNull(summary.calories),
      carbs: toNumOrNull(summary.carbs),
      fat: toNumOrNull(summary.fat),
      fiber: toNumOrNull(summary.fiber),
      protein: toNumOrNull(summary.protein),
      sodium: toNumOrNull(summary.sodium),
      water: toNumOrNull(summary.water),
    },
  };
}

/**
 * Water logs + total water for a date.
 *
 * cURL:
 *   curl -H "Authorization: Bearer $FITBIT_TOKEN" \
 *        -H "Accept: application/json" \
 *        "https://api.fitbit.com/1/user/-/foods/log/water/date/2025-11-19.json"
 *
 * Raw response shape (simplified):
 * {
 *   "water": [
 *     { "logId": ..., "amount": 236.58, "unit": "ml", "logDate": "2025-11-19" },
 *     ...
 *   ],
 *   "summary": { "water": 236.58 }
 * }
 *
 * Normalized return:
 *   { date, waterLogs: [...], waterTotal }
 */
export async function fetchWaterDaily(accessToken: string, dateISO: string) {
  const url = `https://api.fitbit.com/1/user/-/foods/log/water/date/${dateISO}.json`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!r.ok) {
    throw new Error(`WaterDaily HTTP ${r.status}: ${await r.text()}`);
  }

  const j: any = await r.json();

  const waterLogs = Array.isArray(j.water) ? j.water : [];
  const summary = j.summary || {};

  const normalizedLogs = waterLogs.map((w: any) => ({
    logId: w.logId ?? null,
    amount: w.amount ?? null,
    unit: w.unit ?? null,
    logDate: w.logDate ?? dateISO,
  }));

  const waterTotal =
    typeof summary.water === "number" && Number.isFinite(summary.water)
      ? summary.water
      : null;

  return {
    date: dateISO,
    waterLogs: normalizedLogs,
    waterTotal,
  };
}
