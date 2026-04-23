[English](README.md) | [Deutsch](README.de.md)

# Factory Line Integration Demo

Simulated factory line with OPC UA, MQTT, InfluxDB, and Grafana.
Demonstrates a complete integration pipeline from machine protocol to dashboard.

## Architecture

```
+------------------+     +---------------+     +-----------+     +---------+
|  OPC UA Server   |---->|  Data Bridge  |---->|  InfluxDB |---->| Grafana |
|  (node-opcua)    |     |  (Node.js)    |     |           |     |         |
|                  |     |               |     +-----------+     +---------+
|  Simulates:      |     |  Reads OPC UA |            ^
|  - Printer       |     |  Writes:      |            |
|  - Scanner       |     |  - MQTT       |     +------+-------+
|  - Sensor        |     |  - InfluxDB   |     |  Mosquitto   |
|  - Line          |     +---------------+     |  (MQTT)      |
|                  |                           +--------------+
|  HTTP API (:3001)|<----------------------------------------+
+------------------+                                         |
                                                    +--------+--------+
                                                    |  Control Panel  |
                                                    |  (FastAPI :8080)|
                                                    +-----------------+
```

## Components

| Service        | Technology          | Port  | Description                                     |
|----------------|---------------------|-------|-------------------------------------------------|
| opcua-server   | Node.js, node-opcua | 4840  | OPC UA Server with simulated machines           |
| opcua-server   | Node.js, HTTP       | 3001  | REST API for status and control                 |
| mosquitto      | Eclipse Mosquitto   | 1883  | MQTT Broker                                     |
| data-bridge    | Node.js             | -     | Reads OPC UA, publishes MQTT, writes InfluxDB   |
| influxdb       | InfluxDB 2.7        | 8086  | Time series database                            |
| grafana        | Grafana 10.4        | 3000  | Dashboards (auto-provisioned)                   |
| trigger-ui     | Python, FastAPI     | 8080  | Control Panel for controlling the simulation    |

## Quick Start

```bash
docker compose up --build
```

After that:

- **Control Panel:** http://localhost:8080
- **Grafana Dashboard:** http://localhost:3000/d/factory-demo (Login: admin/admin, or without login thanks to Anonymous Access)
- **InfluxDB UI:** http://localhost:8086 (admin/admin12345)

The simulation starts automatically. You can stop/start the line through the Control Panel and trigger errors on the printer or scanner.

## What This Demo Shows

1. **OPC UA Server** with realistic information model (Printer, Scanner, Environmental Sensor, Production Line)
2. **Protocol Diversity:** OPC UA (Machine), MQTT (Event Bus), HTTP/REST (Control), InfluxDB Flux (Time Series)
3. **Event Pipeline:** Printing, Scanning, Validating, Logging as a continuous, event-driven process
4. **Monitoring:** Grafana dashboard with temperature, vibration, OEE, cycle time, print/scan statistics
5. **Error Scenarios:** Manually triggerable errors with automatic recovery
6. **Containerization:** Complete infrastructure in Docker Compose, one command to start

## Technology Stack

- **Node.js** (OPC UA Server, Data Bridge)
- **Python / FastAPI** (Control Panel)
- **OPC UA** (node-opcua)
- **MQTT** (Mosquitto)
- **InfluxDB** (Time Series)
- **Grafana** (Dashboards)
- **Docker / Docker Compose**

## Contact

Marek Rjelka | linkedin.com/in/marek-rjelka
