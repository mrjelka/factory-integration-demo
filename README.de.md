[English](README.md) | [Deutsch](README.de.md)

# Factory Line Integration Demo

Simulierte Fertigungslinie mit OPC UA, MQTT, InfluxDB und Grafana.
Zeigt eine vollständige Integrationspipeline vom Maschinenprotokoll bis zum Dashboard.

## Architektur

```
+------------------+     +---------------+     +-----------+     +---------+
|  OPC UA Server   |---->|  Data Bridge  |---->|  InfluxDB |---->| Grafana |
|  (node-opcua)    |     |  (Node.js)    |     |           |     |         |
|                  |     |               |     +-----------+     +---------+
|  Simuliert:      |     |  Liest OPC UA |            ^
|  - Drucker       |     |  Schreibt:    |            |
|  - Scanner       |     |  - MQTT       |     +------+-------+
|  - Sensor        |     |  - InfluxDB   |     |  Mosquitto   |
|  - Linie         |     +---------------+     |  (MQTT)      |
|                  |                           +--------------+
|  HTTP API (:3001)|<----------------------------------------+
+------------------+                                         |
                                                    +--------+--------+
                                                    |  Control Panel  |
                                                    |  (FastAPI :8080)|
                                                    +-----------------+
```

## Komponenten

| Service        | Technologie         | Port  | Beschreibung                                    |
|----------------|---------------------|-------|-------------------------------------------------|
| opcua-server   | Node.js, node-opcua | 4840  | OPC UA Server mit simulierten Maschinen         |
| opcua-server   | Node.js, HTTP       | 3001  | REST API für Status und Steuerung               |
| mosquitto      | Eclipse Mosquitto   | 1883  | MQTT Broker                                     |
| data-bridge    | Node.js             | -     | Liest OPC UA, publiziert MQTT, schreibt InfluxDB|
| influxdb       | InfluxDB 2.7        | 8086  | Zeitreihendatenbank                             |
| grafana        | Grafana 10.4        | 3000  | Dashboards (auto-provisioniert)                 |
| trigger-ui     | Python, FastAPI     | 8080  | Control Panel zum Steuern der Simulation        |

## Schnellstart

```bash
docker compose up --build
```

Danach:

- **Control Panel:** http://localhost:8080
- **Grafana Dashboard:** http://localhost:3000/d/factory-demo (Login: admin/admin, oder ohne Login dank Anonymous Access)
- **InfluxDB UI:** http://localhost:8086 (admin/admin12345)

Die Simulation startet automatisch. Über das Control Panel kann die Linie gestoppt/gestartet und Fehler an Drucker oder Scanner ausgelöst werden.

## Was die Demo zeigt

1. **OPC UA Server** mit realistischem Informationsmodell (Drucker, Scanner, Umgebungssensor, Produktionslinie)
2. **Protokollvielfalt:** OPC UA (Maschine), MQTT (Event-Bus), HTTP/REST (Steuerung), InfluxDB Flux (Zeitreihen)
3. **Event-Pipeline:** Drucken, Scannen, Validieren, Protokollieren als durchgängiger, ereignisgesteuerter Prozess
4. **Monitoring:** Grafana-Dashboard mit Temperatur, Vibration, OEE, Zykluszeit, Druck-/Scan-Statistiken
5. **Fehlerszenarien:** Manuell auslösbare Fehler mit automatischer Recovery
6. **Containerisierung:** Komplette Landschaft in Docker Compose, ein Befehl zum Starten

## Technologie-Stack

- **Node.js** (OPC UA Server, Data Bridge)
- **Python / FastAPI** (Control Panel)
- **OPC UA** (node-opcua)
- **MQTT** (Mosquitto)
- **InfluxDB** (Zeitreihen)
- **Grafana** (Dashboards)
- **Docker / Docker Compose**

## Ansprechpartner

Marek Rjelka | linkedin.com/in/marek-rjelka
