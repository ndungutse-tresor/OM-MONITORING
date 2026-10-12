import { openDb } from "@/lib/db";
import { isAuthed, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 60, 1000);
  const db = openDb();
  if (!db) return Response.json({ rows: [], latest: null, ready: false });
  try {
    const rows = db.prepare("SELECT * FROM telemetry ORDER BY id DESC LIMIT ?").all(limit).reverse();
    return Response.json({ rows, latest: rows[rows.length - 1] || null, ready: true });
  } finally {
    db.close();
  }
}
