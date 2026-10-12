// Runtime anomaly scoring: fixed thresholds + a statistical (z-score) check
// against the recent past. Every finding carries a plain-language explanation.

export const THRESHOLDS = {
  routerLoss: 50,
  routerLatency: 150,
  cpu: 85,
  ram: 90,
  internetLatency: 300,
  webLatency: 5000,
  staleSeconds: 60,
};

const WEIGHT = { critical: 40, warning: 15 };

function stats(values) {
  const v = values.filter((x) => typeof x === "number");
  if (v.length < 20) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return sd > 0 ? { mean, sd } : null;
}

export function scoreTelemetry(latest, history = []) {
  if (!latest) {
    return { status: "No data", score: 0, findings: [], message: "Waiting for the sensor to write data." };
  }
  const findings = [];
  const add = (severity, metric, label, value, threshold, explanation) =>
    findings.push({ severity, metric, label, value, threshold, explanation, weight: WEIGHT[severity] });

  const ageSec = (Date.now() - new Date(latest.ts).getTime()) / 1000;
  if (ageSec > THRESHOLDS.staleSeconds) {
    add("critical", "sensor", "Sensor offline", `${Math.round(ageSec)}s old`, `${THRESHOLDS.staleSeconds}s`,
      "No new readings. The Python sensor may have stopped or lost power.");
  }
  if ((latest.router_loss ?? 0) >= THRESHOLDS.routerLoss)
    add("critical", "router_loss", "Gateway packet loss", `${latest.router_loss}%`, `${THRESHOLDS.routerLoss}%`,
      "More than half of pings to the gateway are lost. Check the switch port, cable or the router itself.");
  if ((latest.router_latency ?? 0) > THRESHOLDS.routerLatency)
    add("warning", "router_latency", "Gateway latency high", `${latest.router_latency} ms`, `${THRESHOLDS.routerLatency} ms`,
      "Local network is slow. Look for a congested LAN, a loop, or a heavy transfer.");
  if ((latest.cpu ?? 0) > THRESHOLDS.cpu)
    add("critical", "cpu", "CPU saturated", `${latest.cpu}%`, `${THRESHOLDS.cpu}%`,
      "The monitoring host is CPU-bound. Find the busy process in Task Manager.");
  if ((latest.ram ?? 0) > THRESHOLDS.ram)
    add("critical", "ram", "Memory exhausted", `${latest.ram}%`, `${THRESHOLDS.ram}%`,
      "Memory is nearly full, so the system may start swapping or crash.");
  if ((latest.internet_latency ?? 0) > THRESHOLDS.internetLatency)
    add("warning", "internet_latency", "Internet latency high", `${latest.internet_latency} ms`, `${THRESHOLDS.internetLatency} ms`,
      "Slow path to the internet. Check the ISP link (for example the Starlink dish view or the ISP status).");
  if (latest.internet_latency == null && (latest.internet_loss ?? 0) >= 100)
    add("critical", "internet_loss", "No internet reply", "100% loss", "<100%",
      "The internet check target did not answer. The uplink may be down.");
  if (latest.web_status != null && latest.web_status !== 200 && latest.web_status !== 301 && latest.web_status !== 302)
    add("critical", "web_status", "Website not healthy", `HTTP ${latest.web_status || "no reply"}`, "HTTP 200",
      "The monitored website did not return a normal response.");
  if ((latest.web_latency ?? 0) > THRESHOLDS.webLatency && latest.web_status === 200)
    add("warning", "web_latency", "Website slow", `${latest.web_latency} ms`, `${THRESHOLDS.webLatency} ms`,
      "The website answers but very slowly.");

  // Statistical layer: is the latest value far outside the recent normal?
  const past = history.filter((r) => r.id !== latest.id);
  for (const [key, label] of [["router_latency", "Gateway latency"], ["internet_latency", "Internet latency"], ["cpu", "CPU"]]) {
    const s = stats(past.map((r) => r[key]));
    const val = latest[key];
    if (s && typeof val === "number") {
      const z = (val - s.mean) / s.sd;
      if (z > 3 && !findings.some((f) => f.metric === key)) {
        add("warning", key, `${label} unusual`, `${val} (z=${z.toFixed(1)})`, `avg ${s.mean.toFixed(1)}`,
          `Much higher than the last ${past.length} readings. This is a sudden change even though no fixed limit is broken.`);
      }
    }
  }

  const score = Math.min(100, findings.reduce((a, f) => a + f.weight, 0));
  const status = findings.some((f) => f.severity === "critical") ? "Critical" : findings.length ? "Degraded" : "Healthy";
  return { status, score, findings, ts: latest.ts };
}

export function assetStatus(asset, reading) {
  if (!reading) return { ...asset, status: "Unknown", detail: "No data yet" };
  if (!reading.reachable) return { ...asset, status: "Critical", detail: asset.url ? `HTTP ${reading.http_status || "no reply"}` : "No ping reply" };
  const slow = asset.url ? reading.latency > THRESHOLDS.webLatency : reading.latency > THRESHOLDS.routerLatency || (reading.loss ?? 0) > 20;
  return { ...asset, status: slow ? "Degraded" : "Healthy", detail: `${reading.latency ?? "-"} ms${reading.loss ? ` · ${reading.loss}% loss` : ""}` };
}
