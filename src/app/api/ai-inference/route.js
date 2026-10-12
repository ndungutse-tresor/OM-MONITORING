import { openDb } from "@/lib/db";
import { readJson } from "@/lib/paths";
import { isAuthed, unauthorized } from "@/lib/auth";
import { scoreTelemetry, assetStatus } from "@/lib/scoring";
import { maybeAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  const db = openDb();
  if (!db) return Response.json({ ...scoreTelemetry(null), assets: [] });
  try {
    const history = db.prepare("SELECT * FROM telemetry ORDER BY id DESC LIMIT 60").all().reverse();
    const latest = history[history.length - 1] || null;
    const result = scoreTelemetry(latest, history);

    const registry = readJson("assets_registry.json", []);
    const lastReading = db.prepare("SELECT * FROM asset_telemetry WHERE asset_id = ? ORDER BY id DESC LIMIT 1");
    const assets = registry.map((a) => assetStatus(a, lastReading.get(a.id)));

    maybeAlert(result).catch(() => {});
    return Response.json({ ...result, assets });
  } finally {
    db.close();
  }
}
