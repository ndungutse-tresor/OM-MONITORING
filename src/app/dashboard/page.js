"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { usePoll } from "@/lib/useApi";
import { THRESHOLDS } from "@/lib/scoring";

const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Tile({ label, value, unit, level }) {
  return (
    <div className={`tile ${level || ""}`}>
      <div className="k">{label}</div>
      <div className="v">{value ?? "-"}<small>{value != null ? unit : ""}</small></div>
    </div>
  );
}

function Chart({ title, rows, lines, limit, unit }) {
  const data = rows.map((r) => ({ ...r, t: fmt(r.ts) }));
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="#e8ece9" vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11 }} unit={unit} />
            <Tooltip />
            {limit && <ReferenceLine y={limit} stroke="#c0392b" strokeDasharray="4 4" />}
            {lines.map((l) => (
              <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const tel = usePoll("/api/telemetry?limit=90");
  const ai = usePoll("/api/ai-inference");
  const alerts = usePoll("/api/alerts/history", 30000);
  const network = usePoll("/api/network/config", 30000);

  const rows = tel.data?.rows || [];
  const latest = tel.data?.latest;
  const status = ai.data?.status || "No data";
  const findings = ai.data?.findings || [];
  const level = (v, limit) => (v == null ? "" : v > limit ? "bad" : v > limit * 0.8 ? "warn" : "");
  const gatewayStatus = !latest
    ? "Waiting for readings"
    : latest.router_loss == null
      ? "No reading"
      : latest.router_loss >= THRESHOLDS.routerLoss
        ? "Not responding"
        : latest.router_loss > 0
          ? "Some packets lost"
          : latest.router_latency == null
            ? "No reading"
            : latest.router_latency > THRESHOLDS.routerLatency
              ? "Slow response"
              : "Connected";
  const internetStatus = !latest
    ? "Waiting for readings"
    : latest.internet_latency == null || (latest.internet_loss ?? 0) >= 100
      ? "No reply"
      : (latest.internet_loss ?? 0) > 0
        ? "Some packets lost"
        : latest.internet_latency > THRESHOLDS.internetLatency
          ? "Slow response"
          : "Responding";
  const websiteStatus = !latest
    ? "Waiting for readings"
    : !latest.web_status || ![200, 301, 302].includes(latest.web_status)
      ? latest.web_status ? `HTTP ${latest.web_status}` : "No reply"
      : "Responding";
  const checkTone = (value) => {
    if (value === "Responding" || value === "Connected") return "check-good";
    if (value === "Waiting for readings" || value === "No reading") return "check-neutral";
    if (value === "Some packets lost" || value === "Slow response") return "check-warn";
    return "check-attention";
  };
  const nextStep = !latest
    ? "Start the Python sensor to begin collecting readings."
    : gatewayStatus === "Not responding"
      ? `The computer cannot reach gateway ${network.data?.gatewayTarget || ""}. Check the Default Gateway setting, Wi-Fi, or network cable.`
      : gatewayStatus === "Some packets lost" || gatewayStatus === "Slow response"
        ? `The office gateway (${network.data?.gatewayTarget || "configured gateway"}) is reachable but slow or losing packets. Check Wi-Fi signal, network cables, or router load.`
      : internetStatus === "No reply"
        ? `The gateway is reachable, but ${network.data?.checkTarget || "the internet check address"} did not reply. Check the modem or ask your internet provider to check the connection.`
        : internetStatus === "Some packets lost" || internetStatus === "Slow response"
          ? `The internet check (${network.data?.checkTarget || "configured destination"}) is slow or losing packets. Check your modem or ask your internet provider to check the connection.`
          : websiteStatus !== "Responding"
            ? `The internet check is responding, but ${network.data?.websiteTarget || "the monitored website"} is not. Confirm the website URL or check whether the website is down.`
            : "No connection issues detected. Keep the sensor running to continue monitoring.";

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Infrastructure overview</h1>
          <p>Updates every 10 seconds{latest ? ` · last reading ${fmt(latest.ts)}` : ""}</p>
        </div>
      </div>

      {tel.error && <div className="msg err" style={{ marginBottom: 14 }}>{tel.error}</div>}

      <div className={`band ${status.replace(" ", "")}`}>
        <div>
          <h2>{status === "No data" ? "Waiting for sensor" : status}</h2>
          <small>
            {status === "Healthy" && "All checks are inside normal limits."}
            {status === "Degraded" && `${findings.length} warning${findings.length > 1 ? "s" : ""} need attention.`}
            {status === "Critical" && `${findings.filter((f) => f.severity === "critical").length} critical issue(s) detected.`}
            {status === "No data" && "Start the Python sensor: python sensor/om_sensor.py"}
          </small>
        </div>
        <div className="risk"><strong>{ai.data?.score ?? 0}</strong><span>risk score (0-100)</span></div>
      </div>

      <div className="card connection-card">
        <div>
          <h3>Internet connection</h3>
          <strong>{network.data?.connectionName || "Connection name not set"}</strong>
        </div>
        <div>
          <span className="connection-label">Provider</span>
          <strong>{network.data?.providerName || "Not configured"}</strong>
        </div>
        <div>
          <span className="connection-label">Internet check destination</span>
          <strong>{network.data?.checkTarget || "—"}</strong>
        </div>
      </div>

      <div className="card connection-health">
        <h3>Connection checks</h3>
        <div className="connection-checks">
          <div><span>Office gateway</span><strong className={checkTone(gatewayStatus)}>{gatewayStatus}</strong></div>
          <div><span>Internet access</span><strong className={checkTone(internetStatus)}>{internetStatus}</strong></div>
          <div><span>Website</span><strong className={checkTone(websiteStatus)}>{websiteStatus}</strong></div>
        </div>
        <div className="next-step"><b>What to do next</b><p>{nextStep}</p></div>
      </div>

      <div className="tiles">
        <Tile label="Gateway latency" value={latest?.router_latency} unit="ms" level={level(latest?.router_latency, THRESHOLDS.routerLatency)} />
        <Tile label="Gateway packet loss" value={latest?.router_loss} unit="%" level={level(latest?.router_loss, THRESHOLDS.routerLoss)} />
        <Tile label="Internet latency" value={latest?.internet_latency} unit="ms" level={level(latest?.internet_latency, THRESHOLDS.internetLatency)} />
        <Tile label="CPU" value={latest?.cpu} unit="%" level={level(latest?.cpu, THRESHOLDS.cpu)} />
        <Tile label="Memory" value={latest?.ram} unit="%" level={level(latest?.ram, THRESHOLDS.ram)} />
        <Tile label="Website" value={latest ? (latest.web_status || "Down") : null} unit={latest?.web_status ? ` · ${Math.round(latest.web_latency)} ms` : ""} level={latest && latest.web_status !== 200 ? "bad" : ""} />
      </div>

      <div className="grid2">
        <Chart title="Gateway latency (ms)" rows={rows} limit={THRESHOLDS.routerLatency} lines={[{ key: "router_latency", name: "Gateway", color: "#009677" }]} />
        <Chart title="Internet latency (ms)" rows={rows} limit={THRESHOLDS.internetLatency} lines={[{ key: "internet_latency", name: "Internet", color: "#0a3d34" }]} />
        <Chart title="CPU and memory (%)" rows={rows} lines={[{ key: "cpu", name: "CPU", color: "#b86e00" }, { key: "ram", name: "Memory", color: "#5b6ad0" }]} />
        <Chart title="Website response (ms)" rows={rows} limit={THRESHOLDS.webLatency} lines={[{ key: "web_latency", name: "Website", color: "#c0392b" }]} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Technical findings · {status}</h3>
          {findings.length === 0 && <div className="empty">No findings. Every metric is inside its limit and close to its recent average.</div>}
          {findings.map((f, i) => (
            <div key={i} className={`finding ${f.severity}`}>
              <b>{f.label}</b>
              <div className="meta">Now {f.value} · limit {f.threshold}</div>
              <p>{f.explanation}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Monitored assets</h3>
          <div className="assets">
            {(ai.data?.assets || []).length === 0 && <div className="empty">No assets yet. Add some on the Assets page.</div>}
            {(ai.data?.assets || []).map((a) => (
              <div className="asset" key={a.id}>
                <div>
                  <div className="n">{a.name}</div>
                  <div className="d">{a.type} · {a.ip || a.url} · {a.detail}</div>
                </div>
                <span className={`pill ${a.status}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent email alerts</h3>
        {(alerts.data || []).length === 0 ? (
          <div className="empty">No alerts sent yet. Turn alerts on under Alert settings.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Time</th><th>Type</th><th>Subject</th><th>Delivery</th></tr></thead>
              <tbody>
                {alerts.data.map((a, i) => (
                  <tr key={i}>
                    <td>{new Date(a.ts).toLocaleString()}</td>
                    <td><span className={`pill ${a.severity}`}>{a.kind === "recovery" ? "Recovered" : a.severity}</span></td>
                    <td>{a.title}</td>
                    <td>{a.delivered ? "Sent" : `Failed: ${a.error}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
