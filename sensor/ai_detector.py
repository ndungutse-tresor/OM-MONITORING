"""Offline anomaly scan with IsolationForest.  Run: python sensor/ai_detector.py [--contamination 0.05]"""
import argparse
import sqlite3
from pathlib import Path

import pandas as pd
from sklearn.ensemble import IsolationForest

DB = Path(__file__).resolve().parent.parent / "data" / "om_telemetry.db"
FEATURES = ["router_latency", "router_loss", "internet_latency", "cpu", "ram", "web_latency"]

ap = argparse.ArgumentParser()
ap.add_argument("--contamination", type=float, default=0.05)
args = ap.parse_args()

df = pd.read_sql_query("SELECT * FROM telemetry ORDER BY id", sqlite3.connect(DB))
if len(df) < 50:
    raise SystemExit(f"Need at least 50 rows, found {len(df)}. Let the sensor run longer.")
X = df[FEATURES].fillna(df[FEATURES].median())
model = IsolationForest(n_estimators=200, contamination=args.contamination, random_state=42).fit(X)
df["flag"] = model.predict(X)
df["score"] = model.decision_function(X)
bad = df[df["flag"] == -1].sort_values("score")
print(f"Scanned {len(df)} rows, flagged {len(bad)} anomalies\n")
print(bad[["ts"] + FEATURES + ["score"]].head(25).to_string(index=False))
