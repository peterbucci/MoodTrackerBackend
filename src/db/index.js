import Database from "better-sqlite3";
import { applySchema } from "./schema.js";

export const db = new Database("data.sqlite");
db.pragma("journal_mode = WAL");
applySchema(db);
