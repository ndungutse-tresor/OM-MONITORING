import { readJson, writeJson } from "@/lib/paths";
import { isAuthed, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
const FILE = "alert_settings.json";

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json({
    ...readJson(FILE, {}),
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
}

export async function POST(request) {
  if (!isAuthed(request)) return unauthorized();
  const b = await request.json();
  const next = {
    enabled: Boolean(b.enabled),
    recipients: String(b.recipients || "").trim(),
    cooldown_minutes: Math.max(1, Number(b.cooldown_minutes) || 10),
    min_severity: b.min_severity === "warning" ? "warning" : "critical",
  };
  writeJson(FILE, next);
  return Response.json(next);
}
