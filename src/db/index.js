import Database from "better-sqlite3";
import { applySchema } from "./schema.js";
import { applyDesktopSchema } from "./desktopSchema.js";

// Primary app database
export const db = new Database("data.sqlite");
db.pragma("journal_mode = WAL");
applySchema(db);

// Secondary database for desktop app consumption
const desktopDbPath = process.env.DESKTOP_DB_PATH || "desktop-data.db";
export const desktopDb = new Database(desktopDbPath);
desktopDb.pragma("journal_mode = WAL");
applyDesktopSchema(desktopDb);
