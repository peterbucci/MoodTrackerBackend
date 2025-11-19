import { config } from "../../config/index.js";

const EARTH_RADIUS_M = 6371000; // meters
const DEFAULT_CLUSTER_RADIUS_M = 200; // fallback bubble radius in meters

export const LOCATION_CLUSTERS = (() => {
  try {
    const parsed = JSON.parse(config.LOCATION_CLUSTERS);
    if (!Array.isArray(parsed)) {
      console.warn("LOCATION_CLUSTERS is not an array; using empty array");
      return [];
    }
    return parsed;
  } catch (err) {
    console.warn("Invalid LOCATION_CLUSTERS in .env; using empty array", err);
    return [];
  }
})();

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lon points, in meters.
 */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Assign the closest cluster, but only if we're within that cluster's bubble radius.
 * Returns the cluster key (string) or null if outside all bubbles.
 *
 * Expects each cluster to look like:
 * {
 *   key: "cluster1_home",
 *   lat: ...,
 *   lon: ...,
 *   radiusMeters?: 200 // optional, falls back to DEFAULT_CLUSTER_RADIUS_M
 * }
 */
export function assignLocationCluster(lat, lon) {
  if (!Array.isArray(LOCATION_CLUSTERS) || LOCATION_CLUSTERS.length === 0) {
    return null;
  }

  let bestCluster = null;
  let bestDist = Infinity;

  for (const c of LOCATION_CLUSTERS) {
    if (typeof c.lat !== "number" || typeof c.lon !== "number") continue;

    const dist = distanceMeters(lat, lon, c.lat, c.lon);
    const radius =
      typeof c.radiusMeters === "number" && c.radiusMeters > 0
        ? c.radiusMeters
        : DEFAULT_CLUSTER_RADIUS_M;

    // Skip clusters where we're outside the bubble
    if (dist > radius) continue;

    if (dist < bestDist) {
      bestDist = dist;
      bestCluster = c;
    }
  }

  return bestCluster && bestCluster.key ? bestCluster.key : null;
}

/**
 * Build a one-hot object for the given cluster key, e.g.
 * {
 *   locationClusterOneHot_cluster1_home: 1,
 *   locationClusterOneHot_cluster2_campus: 0
 * }
 */
export function buildLocationClusterOneHot(clusterKey) {
  const result = {};
  if (!clusterKey) return result;

  for (const c of LOCATION_CLUSTERS) {
    const featKey = `locationClusterOneHot_${c.key}`;
    result[featKey] = c.key === clusterKey ? 1 : 0;
  }

  return result;
}
