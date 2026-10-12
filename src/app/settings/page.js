"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/useApi";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/alerts/config").then(setS).catch((e) => setMsg({ err: e.message })); }, []);

  async function save(e) {
    e?.preventDefault();
    setMsg(null);
    try {
      await api("/api/alerts/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      setMsg({ ok: "Settings saved." });
    } catch (err) {
      setMsg({ err: err.message });
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      await save();
      await api("/api/alerts/test", { method: "POST" });
      setMsg({ ok: "Test email sent. Check the inbox." });
    } catch (err) {
      setMsg({ err: `Test failed: ${err.message}` });
    }
    setBusy(false);
  }

  if (!s) return <div className="empty">Loading settings...</div>;

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Alert settings</h1>
          <p>Choose who gets an email when the system turns Degraded or Critical.</p>
        </div>
      </div>
      <div className="card">
        {!s.smtpConfigured && (
          <div className="msg err" style={{ marginBottom: 14 }}>
            Email login is missing. Copy .env.local.example to .env.local, add your Gmail App Password, then restart npm run dev.
          </div>
        )}
        <form className="form" onSubmit={save}>
          <label className="check">
            <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
            Send email alerts
          </label>
          <label>Recipients
            <input type="text" placeholder="admin@example.com, noc@example.com" value={s.recipients} onChange={(e) => setS({ ...s, recipients: e.target.value })} />
            <span className="note">Separate several addresses with commas.</span>
          </label>
          <label>Alert when status reaches
            <select value={s.min_severity} onChange={(e) => setS({ ...s, min_severity: e.target.value })}>
              <option value="critical">Critical only</option>
              <option value="warning">Degraded or Critical</option>
            </select>
          </label>
          <label>Minutes between repeat alerts
            <input type="number" min="1" value={s.cooldown_minutes} onChange={(e) => setS({ ...s, cooldown_minutes: e.target.value })} />
          </label>
          {msg?.ok && <div className="msg ok">{msg.ok}</div>}
          {msg?.err && <div className="msg err">{msg.err}</div>}
          <div className="row">
            <button className="btn">Save settings</button>
            <button type="button" className="btn ghost" onClick={test} disabled={busy}>{busy ? "Sending..." : "Send test email"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
