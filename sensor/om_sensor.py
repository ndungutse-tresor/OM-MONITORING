"""
Old Mutual Insurance Rwanda - Infrastructure Sensor
Collects network + host telemetry every N seconds and stores it in SQLite.

Run:   python sensor/om_sensor.py
       python sensor/om_sensor.py --interval 5
Works on Windows, Linux and macOS.
"""
import argparse
import json
import platform
import re
import sqlite3
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import psutil
except ImportError:
    raise SystemExit("Missing package. Run: pip install psutil requests")
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CONFIG_FILE = DATA / "config.json"
REGISTRY_FILE = DATA / "assets_registry.json"
DEFAULT_DB = DATA / "om_telemetry.db"

IS_WINDOWS = platform.system().lower() == "windows"


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def ping(host, count=3, timeout_s=2):
    """Return (avg_latency_ms or None, loss_percent)."""
    if not host:
        return None, 100.0
    if IS_WINDOWS:
        cmd = ["ping", "-n", str(count), "-w", str(timeout_s * 1000), host]
    else:
        cmd = ["ping", "-c", str(count), "-W", str(timeout_s), host]
    try:
        out = subprocess.run(
            cmd, capture_output=True, text=True, timeout=count * timeout_s + 5
        ).stdout
    except Exception:
        return None, 100.0
    times = [float(x) for x in re.findall(r"time[=<]\s*([\d.]+)\s*ms", out, re.I)]
    loss_m = re.search(r"(\d+(?:\.\d+)?)%\s*(?:packet\s*)?loss", out, re.I)
    loss = float(loss_m.group(1)) if loss_m else (0.0 if times else 100.0)
    latency = round(sum(times) / len(times), 2) if times else None
    return latency, loss


def http_probe(url, timeout_s=8):
    """Return (status_code, latency_ms). status 0 = unreachable."""
    start = time.perf_counter()
    try:
        r = requests.get(url, timeout=timeout_s, allow_redirects=True,
                         headers={"User-Agent": "OM-Monitor/1.0"})
        return r.status_code, round((time.perf_counter() - start) * 1000, 1)
    except Exception:
        return 0, round((time.perf_counter() - start) * 1000, 1)


def init_db(path):
    conn = sqlite3.connect(path, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            router_latency REAL, router_loss REAL,
            internet_latency REAL, internet_loss REAL,
            cpu REAL, ram REAL,
            web_status INTEGER, web_latency REAL
        );
        CREATE TABLE IF NOT EXISTS asset_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            reachable INTEGER, latency REAL, loss REAL, http_status INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tel_ts ON telemetry(ts);
        CREATE INDEX IF NOT EXISTS idx_asset_ts ON asset_telemetry(asset_id, ts);
        """
    )
    conn.commit()
    return conn


def probe_asset(asset):
    row = {"asset_id": asset["id"], "reachable": 0, "latency": None, "loss": None, "http_status": None}
    if asset.get("url"):
        status, lat = http_probe(asset["url"])
        row.update(reachable=1 if 200 <= status < 400 else 0, latency=lat, http_status=status)
    elif asset.get("ip"):
        lat, loss = ping(asset["ip"], count=2)
        row.update(reachable=1 if loss < 100 else 0, latency=lat, loss=loss)
    return row


def collect(cfg):
    registry = load_json(REGISTRY_FILE, [])
    with ThreadPoolExecutor(max_workers=8) as pool:
        f_router = pool.submit(ping, cfg["router_ip"])
        f_dns = pool.submit(ping, cfg["dns_ip"])
        f_web = pool.submit(http_probe, cfg["website_url"])
        f_assets = [pool.submit(probe_asset, a) for a in registry]
        router_lat, router_loss = f_router.result()
        net_lat, net_loss = f_dns.result()
        web_status, web_lat = f_web.result()
        assets = [f.result() for f in f_assets]
    return {
        "router_latency": router_lat, "router_loss": router_loss,
        "internet_latency": net_lat, "internet_loss": net_loss,
        "cpu": psutil.cpu_percent(interval=None), "ram": psutil.virtual_memory().percent,
        "web_status": web_status, "web_latency": web_lat,
    }, assets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=int, help="seconds between polls")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    args = ap.parse_args()

    cfg = load_json(CONFIG_FILE, {})
    for k, v in {"router_ip": "192.168.1.1", "dns_ip": "8.8.8.8",
                 "website_url": "https://www.oldmutual.co.rw", "interval_seconds": 10,
                 "retention_days": 7}.items():
        cfg.setdefault(k, v)
    interval = args.interval or cfg["interval_seconds"]

    conn = init_db(args.db)
    psutil.cpu_percent(interval=None)  # prime
    print(f"[OM sensor] DB: {args.db} | router {cfg['router_ip']} | every {interval}s | Ctrl+C to stop")
    cycles = 0
    while True:
        started = time.time()
        cfg = {**cfg, **load_json(CONFIG_FILE, {})}
        try:
            t, assets = collect(cfg)
            ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
            conn.execute(
                "INSERT INTO telemetry (ts,router_latency,router_loss,internet_latency,internet_loss,cpu,ram,web_status,web_latency) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (ts, t["router_latency"], t["router_loss"], t["internet_latency"], t["internet_loss"],
                 t["cpu"], t["ram"], t["web_status"], t["web_latency"]),
            )
            conn.executemany(
                "INSERT INTO asset_telemetry (ts,asset_id,reachable,latency,loss,http_status) VALUES (?,?,?,?,?,?)",
                [(ts, a["asset_id"], a["reachable"], a["latency"], a["loss"], a["http_status"]) for a in assets],
            )
            conn.commit()
            print(f"{ts} router={t['router_latency']}ms/{t['router_loss']}% net={t['internet_latency']}ms "
                  f"cpu={t['cpu']}% ram={t['ram']}% web={t['web_status']} ({t['web_latency']}ms)")
            cycles += 1
            if cycles % 360 == 0:
                cutoff = (datetime.now(timezone.utc) - timedelta(days=cfg["retention_days"])).isoformat(timespec="seconds")
                conn.execute("DELETE FROM telemetry WHERE ts < ?", (cutoff,))
                conn.execute("DELETE FROM asset_telemetry WHERE ts < ?", (cutoff,))
                conn.commit()
        except KeyboardInterrupt:
            break
        except Exception as e:
            print("[OM sensor] cycle error:", e)
        try:
            time.sleep(max(0.5, interval - (time.time() - started)))
        except KeyboardInterrupt:
            break
    conn.close()
    print("\n[OM sensor] stopped")


if __name__ == "__main__":
    main()
