import os
import httpx
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

OPCUA_HTTP = os.getenv("OPCUA_HTTP_URL", "http://opcua-server:3001")

app = FastAPI(title="Factory Control Panel")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Factory Line Control</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0e17;
    --surface: #111827;
    --surface2: #1a2235;
    --border: #2a3550;
    --text: #e2e8f0;
    --text-dim: #8892a8;
    --accent: #38bdf8;
    --green: #22c55e;
    --red: #ef4444;
    --amber: #f59e0b;
    --font-mono: 'JetBrains Mono', monospace;
    --font-sans: 'IBM Plex Sans', sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    min-height: 100vh;
    padding: 24px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }

  .header-icon {
    width: 42px; height: 42px;
    background: linear-gradient(135deg, var(--accent), #6366f1);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
  }

  .header h1 {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .header .sub {
    color: var(--text-dim);
    font-size: 13px;
    font-family: var(--font-mono);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 28px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }

  .card-title {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text-dim);
    margin-bottom: 16px;
  }

  .machine-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .machine-row:last-child { border-bottom: none; }

  .machine-name {
    font-weight: 600;
    font-size: 14px;
  }

  .status-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
    margin-right: 8px;
    animation: pulse 2s infinite;
  }

  .status-dot.idle { background: var(--text-dim); animation: none; }
  .status-dot.running, .status-dot.printing, .status-dot.scanning { background: var(--green); }
  .status-dot.error { background: var(--red); }
  .status-dot.stopped { background: var(--amber); animation: none; }
  .status-dot.paused { background: var(--amber); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }

  .stat {
    text-align: center;
    padding: 12px 8px;
    background: var(--surface2);
    border-radius: 8px;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  button {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.15s;
    background: var(--surface2);
    color: var(--text);
  }

  button:hover { border-color: var(--accent); color: var(--accent); }
  button:active { transform: scale(0.97); }

  button.primary {
    background: var(--green);
    color: #000;
    border-color: var(--green);
  }
  button.primary:hover { background: #16a34a; border-color: #16a34a; color: #000; }

  button.danger {
    background: transparent;
    color: var(--red);
    border-color: var(--red);
  }
  button.danger:hover { background: var(--red); color: #fff; }

  button.stop {
    background: var(--amber);
    color: #000;
    border-color: var(--amber);
  }
  button.stop:hover { background: #d97706; border-color: #d97706; }

  .log-container {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-top: 0;
  }

  .log-entries {
    max-height: 260px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.8;
  }

  .log-entries::-webkit-scrollbar { width: 6px; }
  .log-entries::-webkit-scrollbar-track { background: transparent; }
  .log-entries::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .log-entry { padding: 2px 0; }
  .log-time { color: var(--text-dim); }
  .log-source { color: var(--accent); font-weight: 600; }
  .log-info { color: var(--green); }
  .log-warning { color: var(--amber); }
  .log-error { color: var(--red); }

  .arch-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    letter-spacing: 0.5px;
  }

  .arch-label span { color: var(--accent); }
</style>
</head>
<body>

<div class="header">
  <div class="header-icon">&#9881;</div>
  <div>
    <h1>Factory Line Control</h1>
    <div class="sub">OPC UA &bull; MQTT &bull; InfluxDB &bull; Grafana</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div class="card-title">Machine Status</div>
    <div id="machine-status">
      <div class="machine-row">
        <div><span class="status-dot idle" id="dot-line"></span><span class="machine-name">Production Line</span></div>
        <span id="status-line" style="font-family:var(--font-mono);font-size:13px">--</span>
      </div>
      <div class="machine-row">
        <div><span class="status-dot idle" id="dot-printer"></span><span class="machine-name">Printer</span></div>
        <span id="status-printer" style="font-family:var(--font-mono);font-size:13px">--</span>
      </div>
      <div class="machine-row">
        <div><span class="status-dot idle" id="dot-scanner"></span><span class="machine-name">Scanner</span></div>
        <span id="status-scanner" style="font-family:var(--font-mono);font-size:13px">--</span>
      </div>
    </div>

    <div style="margin-top:20px">
      <div class="card-title">Controls</div>
      <div class="btn-group">
        <button class="primary" onclick="send('/api/start')">&#9654; Start Line</button>
        <button class="stop" onclick="send('/api/stop')">&#9632; Stop Line</button>
        <button class="danger" onclick="send('/api/error/printer')">&#9888; Printer Error</button>
        <button class="danger" onclick="send('/api/error/scanner')">&#9888; Scanner Error</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Production KPIs</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-value" id="kpi-parts">0</div><div class="stat-label">Parts</div></div>
      <div class="stat"><div class="stat-value" id="kpi-oee">0%</div><div class="stat-label">OEE</div></div>
      <div class="stat"><div class="stat-value" id="kpi-cycle">0s</div><div class="stat-label">Cycle</div></div>
      <div class="stat"><div class="stat-value" id="kpi-prints-ok">0</div><div class="stat-label">Prints OK</div></div>
      <div class="stat"><div class="stat-value" id="kpi-scans-ok">0</div><div class="stat-label">Scans OK</div></div>
      <div class="stat"><div class="stat-value" id="kpi-fails">0</div><div class="stat-label">Failures</div></div>
    </div>

    <div style="margin-top:20px">
      <div class="card-title">Environment</div>
      <div class="stat-grid">
        <div class="stat"><div class="stat-value" id="env-temp">--</div><div class="stat-label">Temp &deg;C</div></div>
        <div class="stat"><div class="stat-value" id="env-hum">--</div><div class="stat-label">Humidity %</div></div>
        <div class="stat"><div class="stat-value" id="env-vib">--</div><div class="stat-label">Vibration</div></div>
      </div>
    </div>
  </div>
</div>

<div class="log-container">
  <div class="card-title">Event Log (live)</div>
  <div class="log-entries" id="log-entries"></div>
</div>

<div class="arch-label">
  <span>OPC UA Server</span> &rarr; Data Bridge &rarr; <span>MQTT</span> + <span>InfluxDB</span> &rarr; <span>Grafana</span> | Control Panel &rarr; HTTP API &rarr; <span>OPC UA</span>
</div>

<script>
const API = window.location.origin;

async function send(path) {
  try { await fetch(API + path, { method: 'POST' }); } catch(e) { console.error(e); }
}

function setDot(id, status) {
  const dot = document.getElementById(id);
  dot.className = 'status-dot ' + (status || 'idle');
}

async function refresh() {
  try {
    const res = await fetch(API + '/api/status');
    const data = await res.json();
    const m = data.machines;

    // Status
    document.getElementById('status-line').textContent = m.line.status;
    document.getElementById('status-printer').textContent = m.printer.status;
    document.getElementById('status-scanner').textContent = m.scanner.status;
    setDot('dot-line', m.line.status);
    setDot('dot-printer', m.printer.status);
    setDot('dot-scanner', m.scanner.status);

    // KPIs
    document.getElementById('kpi-parts').textContent = m.line.partsProduced;
    document.getElementById('kpi-oee').textContent = (m.line.oee * 100).toFixed(1) + '%';
    document.getElementById('kpi-cycle').textContent = m.line.cycleTime.toFixed(1) + 's';
    document.getElementById('kpi-prints-ok').textContent = m.printer.printsOk;
    document.getElementById('kpi-scans-ok').textContent = m.scanner.scansOk;
    document.getElementById('kpi-fails').textContent = m.printer.printsFailed + m.scanner.scansFailed;

    // Environment
    document.getElementById('env-temp').textContent = m.sensor.temperature.toFixed(1);
    document.getElementById('env-hum').textContent = m.sensor.humidity.toFixed(0);
    document.getElementById('env-vib').textContent = m.sensor.vibration.toFixed(3);

    // Logs
    const logDiv = document.getElementById('log-entries');
    const events = data.eventLog || [];
    logDiv.innerHTML = events.slice(-40).reverse().map(e =>
      `<div class="log-entry"><span class="log-time">${e.timestamp.substr(11,8)}</span> <span class="log-source">[${e.source}]</span> <span class="log-${e.type}">${e.message}</span></div>`
    ).join('');
  } catch(e) {}
}

setInterval(refresh, 1500);
refresh();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML_PAGE


@app.post("/api/{path:path}")
async def proxy_post(path: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{OPCUA_HTTP}/api/{path}")
        return resp.json()


@app.get("/api/{path:path}")
async def proxy_get(path: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{OPCUA_HTTP}/api/{path}")
        return resp.json()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
