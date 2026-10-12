import nodemailer from "nodemailer";
import { readJson, writeJson } from "./paths";

const RANK = { Healthy: 0, Degraded: 1, Critical: 2 };

export function getHistory() {
  return readJson("alert_history.json", []);
}

function transporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) throw new Error("SMTP_USER / SMTP_PASS missing in .env.local");
  return nodemailer.createTransport({
    host: SMTP_HOST || "smtp.gmail.com",
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendMail({ subject, text }) {
  const settings = readJson("alert_settings.json", {});
  if (!settings.recipients) throw new Error("No recipient set in Settings");
  await transporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: settings.recipients,
    subject,
    text,
  });
}

// Called by the AI inference route. Sends at most one email per cooldown window,
// and one recovery email when things return to Healthy.
export async function maybeAlert(result) {
  const settings = readJson("alert_settings.json", {});
  if (!settings.enabled || !result || result.status === "No data") return;

  const history = getHistory();
  const last = history[0];
  const now = Date.now();
  const cooldown = (settings.cooldown_minutes ?? 10) * 60 * 1000;
  const minRank = settings.min_severity === "warning" ? 1 : 2;
  const lastWasBad = last && last.kind === "alert";

  let entry = null;
  if (RANK[result.status] >= minRank) {
    if (!last || now - new Date(last.ts).getTime() > cooldown || (!lastWasBad)) {
      entry = {
        kind: "alert",
        severity: result.status,
        title: `[Old Mutual Monitor] ${result.status}: ${result.findings[0]?.label || "issue detected"}`,
        body: result.findings.map((f) => `- ${f.label}: ${f.value} (limit ${f.threshold})\n  ${f.explanation}`).join("\n"),
      };
    }
  } else if (result.status === "Healthy" && lastWasBad) {
    entry = { kind: "recovery", severity: "Healthy", title: "[Old Mutual Monitor] Recovered", body: "All checks are back to normal." };
  }
  if (!entry) return;

  let delivered = true;
  let error = null;
  try {
    await sendMail({ subject: entry.title, text: entry.body });
  } catch (e) {
    delivered = false;
    error = e.message;
  }
  writeJson("alert_history.json", [{ ts: new Date().toISOString(), delivered, error, ...entry }, ...history].slice(0, 100));
}
