import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { fileURLToPath } from "url";
import { config } from "../src/config/index.js"; // adjust if your config path is different

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log("Running exportClusterBubbles...");
    console.log("Current working dir:", process.cwd());
    console.log("Script dir:", __dirname);

    if (!config.LOCATION_CLUSTERS) {
      console.error("config.LOCATION_CLUSTERS is missing or empty");
      return;
    }

    console.log("Raw LOCATION_CLUSTERS:", config.LOCATION_CLUSTERS);

    let clusters;
    try {
      clusters = JSON.parse(config.LOCATION_CLUSTERS);
    } catch (err) {
      console.error("Failed to parse LOCATION_CLUSTERS as JSON:", err);
      return;
    }

    if (!Array.isArray(clusters)) {
      console.error("LOCATION_CLUSTERS is not an array:", clusters);
      return;
    }

    if (clusters.length === 0) {
      console.warn("LOCATION_CLUSTERS is an empty array; nothing to export.");
      return;
    }

    const features = [];

    for (const c of clusters) {
      if (typeof c.lat !== "number" || typeof c.lon !== "number") {
        console.warn("Skipping cluster with invalid lat/lon:", c);
        continue;
      }

      const radius =
        typeof c.radiusMeters === "number" && c.radiusMeters > 0
          ? c.radiusMeters
          : 200;

      // Center point
      const center = turf.point([c.lon, c.lat], {
        key: c.key,
        radiusMeters: radius,
        type: "center",
      });
      features.push(center);

      // Bubble polygon
      const bubble = turf.buffer(center, radius, { units: "meters" });
      bubble.properties = {
        key: c.key,
        radiusMeters: radius,
        type: "bubble",
      };
      features.push(bubble);
    }

    const fc = turf.featureCollection(features);

    const outputPath = path.resolve(process.cwd(), "cluster-bubbles.geojson");

    fs.writeFileSync(outputPath, JSON.stringify(fc, null, 2), "utf8");

    console.log("Wrote cluster-bubbles.geojson to:", outputPath);
  } catch (err) {
    console.error("exportClusterBubbles failed:", err);
  }
}

main();
