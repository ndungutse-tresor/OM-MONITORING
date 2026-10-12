import path from "path";
import fs from "fs";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "om_telemetry.db");

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}
