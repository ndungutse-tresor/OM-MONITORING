"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/useApi";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [network, setNetwork] = useState(null);
  const [msg, setMsg] = useState(null);
  const [networkMsg, setNetworkMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/alerts/config").then(setS).catch((e) => setMsg({ err: e.message })); }, []);
  useEffect(() => { api("/api/network/config").then(setNetwork).catch((e) => setNetworkMsg({ err: e.message })); }, []);

  async function saveNetwork(e) {
    e.preventDefault();
    setNetworkMsg(null);
    try {
      const updated = await api("/api/network/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(network),
      });
      setNetwork(updated);
      setNetworkMsg({ ok: "Internet connection details saved." });
    } catch (err) {
      setNetworkMsg({ err: err.message });
    }
  }

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
          <h1>Settings</h1>
          <p>Set a clear name for your internet connection and configure alerts.</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>Internet connection</h3>
        <p className="note" style={{ margin: "0 0 14px" }}>
          These names are shown on the dashboard. Enter the provider name from your ISP contract or router; it is not detected automatically.
        </p>
        {!network && <div className={networkMsg?.err ? "msg err" : "empty"}>{networkMsg?.err || "Loading connection settings..."}</div>}
        {network && (
          <form className="form" onSubmit={saveNetwork}>
            <label>Connection name
              <input
                type="text"
                maxLength={100}
                value={network.connectionName}
                onChange={(e) => setNetwork({ ...network, connectionName: e.target.value })}
                placeholder="e.g. Main office fiber"
                required
              />
            </label>
            <label>Internet provider (ISP)
              <input
                type="text"
                maxLength={100}
                value={network.providerName}
                onChange={(e) => setNetwork({ ...network, providerName: e.target.value })}
                placeholder="e.g. MTN, Airtel, or Liquid"
              />
            </label>
            <label>Gateway address
              <input
                type="text"
                value={network.gatewayTarget}
                onChange={(e) => setNetwork({ ...network, gatewayTarget: e.target.value })}
                placeholder="e.g. 192.168.1.1"
                required
              />
              <span className="note">On Windows, find this under Default Gateway in the output of ipconfig.</span>
            </label>
            <label>Internet check address
              <input
                type="text"
                value={network.checkTarget}
                onChange={(e) => setNetwork({ ...network, checkTarget: e.target.value })}
                placeholder="e.g. 8.8.8.8"
                required
              />
              <span className="note">This address checks internet reachability; it is not your ISP name.</span>
            </label>
            <label>Website to monitor
              <input
                type="text"
                value={network.websiteTarget}
                onChange={(e) => setNetwork({ ...network, websiteTarget: e.target.value })}
                placeholder="https://example.com"
                required
              />
            </label>
            {networkMsg?.ok && <div className="msg ok">{networkMsg.ok}</div>}
            {networkMsg?.err && <div className="msg err">{networkMsg.err}</div>}
            <div><button className="btn">Save connection</button></div>
          </form>
        )}
      </div>
      <div className="card">
        <h3>Email alerts</h3>
        <p className="note" style={{ margin: "-4px 0 14px" }}>
          Choose who gets an email when the system turns Degraded or Critical.
        </p>
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
