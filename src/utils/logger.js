export function logFetchedFitbitData(dateStr, data) {
  const {
    stepsSeries,
    heartSeries,
    azmSeries,
    breathingSeries,
    hrvJson,
    dailyJson,
    caloriesJson,
    exerciseJson,
    sleepJson,
    rhr7dJson,
    steps7dJson,
    spo2Daily,
    tempSkinDaily,
    nutritionDaily,
    waterDaily,
    hrvIntraday,
  } = data;

  console.log(`\n=== FETCHED DATA FOR ${dateStr} ===`);

  console.log(
    "stepsSeries:",
    Array.isArray(stepsSeries) ? `count=${stepsSeries.length}` : stepsSeries
  );

  console.log(
    "heartSeries:",
    Array.isArray(heartSeries) ? `count=${heartSeries.length}` : heartSeries
  );

  console.log(
    "azmSeries:",
    Array.isArray(azmSeries) ? `count=${azmSeries.length}` : azmSeries
  );

  console.log(
    "breathingSeries:",
    Array.isArray(breathingSeries)
      ? `count=${breathingSeries.length}`
      : breathingSeries
  );

  console.log("hrvJson:", hrvJson ? Object.keys(hrvJson) : hrvJson);

  console.log("dailyJson:", dailyJson ? Object.keys(dailyJson) : dailyJson);

  console.log(
    "caloriesJson:",
    caloriesJson ? Object.keys(caloriesJson) : caloriesJson
  );

  console.log(
    "exerciseJson:",
    exerciseJson ? JSON.stringify(exerciseJson) : exerciseJson
  );

  console.log(
    "sleepJson:",
    sleepJson ? `logs=${sleepJson.sleep?.length ?? 0}` : sleepJson
  );

  console.log("rhr7dJson:", rhr7dJson ? Object.keys(rhr7dJson) : rhr7dJson);

  console.log(
    "steps7dJson:",
    steps7dJson ? Object.keys(steps7dJson) : steps7dJson
  );

  //
  // === NEW DATA SOURCES ===
  //

  console.log(
    "spo2Daily:",
    spo2Daily
      ? `avg=${spo2Daily.spo2Avg}, min=${spo2Daily.spo2Min}, max=${spo2Daily.spo2Max}`
      : spo2Daily
  );

  console.log(
    "tempSkinDaily:",
    tempSkinDaily
      ? `nightlyRelative=${tempSkinDaily.tempSkinNightlyRelative}`
      : tempSkinDaily
  );

  console.log(
    "nutritionDaily:",
    nutritionDaily
      ? {
          foods: nutritionDaily.foods?.length ?? 0,
          summary: nutritionDaily.nutritionSummary,
        }
      : nutritionDaily
  );

  console.log(
    "waterDaily:",
    waterDaily
      ? {
          logs: waterDaily.waterLogs?.length ?? 0,
          total: waterDaily.waterTotal,
        }
      : waterDaily
  );

  console.log(
    "hrvIntraday:",
    Array.isArray(hrvIntraday) ? `count=${hrvIntraday.length}` : hrvIntraday
  );

  console.log("=====================================\n");
}
