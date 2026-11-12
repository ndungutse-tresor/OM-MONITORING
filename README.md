# Old Mutual Insurance Rwanda - Infrastructure Monitor

Python sensor + Next.js dashboard. The sensor writes network/host readings to SQLite;
the dashboard reads them, scores them (fixed limits + statistical check), explains each
finding, and can send email alerts.

## 1. Set up (once)
1. Install Python 3.9+ and Node.js 18+
2. In VS Code open this folder, then in the terminal:
   ```
   pip install -r requirements.txt
   npm install
   ```
3. Copy `.env.local.example` to `.env.local` and fill it in
   (login password, and Gmail App Password if you want email alerts).
4. Set the internet connection name, provider, gateway, internet check address, and monitored website
   under Settings in the dashboard. On Windows, find the gateway by running `ipconfig` and reading
   "Default Gateway".
5. Enter your connection name and ISP/provider under Settings in the dashboard.
   Edit `data/assets_registry.json` or add assets later in the dashboard (Assets page).

## 2. Run (two terminals)
```
python sensor/om_sensor.py     # terminal 1 - keep running
npm run dev                    # terminal 2 - open http://localhost:3001
```
Sign in with ADMIN_USER / ADMIN_PASS from `.env.local` (defaults: admin / admin123).

## 3. Test
- `python sensor/inject_anomaly.py` adds a fake incident (CPU, latency or HTTP 503)
- `python sensor/ai_detector.py` runs an offline IsolationForest scan once you have 50+ rows

## Files
- `sensor/om_sensor.py`   collects data (ping gateway, ping internet, HTTP probe, CPU/RAM, every asset)
- `data/config.json`      gateway IP, website, interval
- `connection_name` / `isp_name` in `data/config.json` identify the connection and provider shown on the dashboard; enter these manually because the app does not identify the ISP automatically.
- Settings lets you edit the gateway, internet check address and website URL used by the Python sensor.
- `data/assets_registry.json`  monitored assets (editable from the UI)
- `src/lib/scoring.js`    all thresholds and the anomaly logic
- The dashboard's **Ask for help** chat explains live readings locally; it does not use an external AI service.
- Paste an `https://` website link into the help chat and choose **Add to monitoring** to register an external website. The Python sensor checks registered websites each cycle.
- `src/app/api/*`         telemetry, ai-inference, assets, alerts, auth
- `src/app/dashboard|inventory|settings|login`  the pages

## Notes
- Works on Windows, Linux and macOS (ping syntax is detected automatically).
- Only monitor networks and devices you are authorised to monitor.
- Change thresholds in `src/lib/scoring.js` (THRESHOLDS).
- For real deployment: use a strong ADMIN_PASS and AUTH_SECRET, and run behind HTTPS.
