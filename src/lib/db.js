import Database from "better-sqlite3";
import fs from "fs";
import { DB_PATH } from "./paths";

// Returns null until the Python sensor has created the database.
export function openDb() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }
}
