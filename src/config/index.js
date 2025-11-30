import "dotenv/config";

export const config = {
  PORT: Number(process.env.PORT || 3000),
  BASE_URL: process.env.BASE_URL,
  FITBIT_CLIENT_ID: process.env.FITBIT_CLIENT_ID,
  FITBIT_CLIENT_SECRET: process.env.FITBIT_CLIENT_SECRET,
  FITBIT_REDIRECT_URI: process.env.FITBIT_REDIRECT_URI,
  FITBIT_SUBSCRIBER_ID: process.env.FITBIT_SUBSCRIBER_ID,
  FITBIT_VERIFICATION_CODE: process.env.FITBIT_VERIFICATION_CODE,
  FETCH_DEBOUNCE_MS: Number(process.env.FETCH_DEBOUNCE_MS || "600000"),
  API_SECRET: process.env.API_SECRET,
  LOCATION_CLUSTERS: process.env.LOCATION_CLUSTERS,
  ORIGIN: process.env.ORIGIN,
  DESKTOP_DB_PATH: process.env.DESKTOP_DB_PATH,
  DUAL_WRITE_DESKTOP:
    process.env.DUAL_WRITE_DESKTOP == null
      ? true
      : process.env.DUAL_WRITE_DESKTOP === "true",
};
