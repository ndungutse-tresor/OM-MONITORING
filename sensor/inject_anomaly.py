"""Insert a fake anomaly row so you can test dashboard alerts.  Run: python sensor/inject_anomaly.py"""
import random
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "om_telemetry.db"
scenarios = {
    "CPU saturation": dict(cpu=97.0, ram=70.0, router_latency=8.0, router_loss=0.0, internet_latency=40.0, web_status=200, web_latency=600.0),
    "High latency": dict(cpu=30.0, ram=55.0, router_latency=420.0, router_loss=10.0, internet_latency=650.0, web_status=200, web_latency=2500.0),
    "Website down (HTTP 503)": dict(cpu=25.0, ram=50.0, router_latency=5.0, router_loss=0.0, internet_latency=35.0, web_status=503, web_latency=7000.0),
}
name, v = random.choice(list(scenarios.items()))
conn = sqlite3.connect(DB)
conn.execute(
    "INSERT INTO telemetry (ts,router_latency,router_loss,internet_latency,internet_loss,cpu,ram,web_status,web_latency) VALUES (?,?,?,?,?,?,?,?,?)",
    (datetime.now(timezone.utc).isoformat(timespec="seconds"), v["router_latency"], v["router_loss"],
     v["internet_latency"], 0.0, v["cpu"], v["ram"], v["web_status"], v["web_latency"]),
)
conn.commit()
print("Injected:", name)
