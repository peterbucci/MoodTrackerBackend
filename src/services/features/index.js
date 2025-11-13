// Central place to aggregate all feature families per request.
// Later, add: import { featuresFromHeartRate } from "./hrFeatures.js"; etc.
import { featuresFromSteps } from "./stepsFeatures.js";

export async function buildAllFeatures({ stepsSeries, now }) {
  // In the future, fetch and pass in other series (HR, sleep, etc.)
  const feats = {
    ...featuresFromSteps(stepsSeries, now),
    // ...featuresFromHeartRate(hrSeries, now),
  };
  return feats;
}
