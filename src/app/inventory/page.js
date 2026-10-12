"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, usePoll } from "@/lib/useApi";

const TYPES = ["Router", "Switch", "Server", "Firewall", "Website", "Application"];
const ENVS = ["Prod", "Core", "Edge", "WAN", "Dev"];
const blank = { name: "", type: "Server", environment: "Prod", ip: "", url: "" };

export default function Inventory() {
  const assets = usePoll("/api/assets", 0);
  const status = usePoll("/api/ai-inference", 10000);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  const statusOf = (id) => status.data?.assets?.find((a) => a.id === id)?.status || "Unknown";
  const isWeb = form && (form.type === "Website" || form.type === "Application");

  async function save(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/assets", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(null);
      assets.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(a) {
    if (!confirm(`Remove ${a.name} from monitoring?`)) return;
    await api(`/api/assets?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
    assets.reload();
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Assets</h1>
          <p>Devices and services the sensor checks every cycle.</p>
        </div>
        <button className="btn" onClick={() => { setError(""); setForm({ ...blank }); }}><Plus size={15} style={{ verticalAlign: -2 }} /> Add asset</button>
      </div>

      <div className="card tablewrap">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Environment</th><th>Address</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(assets.data || []).map((a) => (
              <tr key={a.id}>
                <td><b>{a.name}</b></td>
                <td>{a.type}</td>
                <td>{a.environment}</td>
                <td>{a.ip || a.url}</td>
                <td><span className={`pill ${statusOf(a.id)}`}>{statusOf(a.id)}</span></td>
                <td>
                  <div className="row">
                    <button className="btn ghost" onClick={() => { setError(""); setForm({ ...blank, ...a }); }} aria-label={`Edit ${a.name}`}><Pencil size={14} /></button>
                    <button className="btn danger" onClick={() => remove(a)} aria-label={`Delete ${a.name}`}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.data?.length === 0 && <div className="empty">No assets yet. Add your first router, server or website.</div>}
      </div>

      {form && (
        <div className="modalbg" onClick={() => setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? "Edit asset" : "Add asset"}</h3>
            <form className="form" onSubmit={save}>
              <label>Name
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label>Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Environment
                <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                  {ENVS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              {isWeb ? (
                <label>URL
                  <input type="text" placeholder="https://example.com" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
                </label>
              ) : (
                <label>IP address
                  <input type="text" placeholder="192.168.1.10" value={form.ip || ""} onChange={(e) => setForm({ ...form, ip: e.target.value })} required />
                </label>
              )}
              {error && <div className="msg err">{error}</div>}
              <div className="row">
                <button className="btn">Save asset</button>
                <button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
