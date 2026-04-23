const {
  OPCUAClient,
  AttributeIds,
  TimestampsToReturn,
} = require("node-opcua-client");
const mqtt = require("mqtt");
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const OPCUA_ENDPOINT = process.env.OPCUA_ENDPOINT || "opc.tcp://localhost:4840";
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const INFLUXDB_URL = process.env.INFLUXDB_URL || "http://localhost:8086";
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN || "demo-token-123";
const INFLUXDB_ORG = process.env.INFLUXDB_ORG || "senodis";
const INFLUXDB_BUCKET = process.env.INFLUXDB_BUCKET || "factory";

const POLL_INTERVAL = 2000;

// Node IDs to poll
const NODES = [
  // Printer
  {
    id: "ns=1;s=Printer.Status",
    tag: "printer",
    field: "status",
    type: "string",
  },
  {
    id: "ns=1;s=Printer.Temperature",
    tag: "printer",
    field: "temperature",
    type: "float",
  },
  {
    id: "ns=1;s=Printer.PrintsTotal",
    tag: "printer",
    field: "prints_total",
    type: "int",
  },
  {
    id: "ns=1;s=Printer.PrintsOk",
    tag: "printer",
    field: "prints_ok",
    type: "int",
  },
  {
    id: "ns=1;s=Printer.PrintsFailed",
    tag: "printer",
    field: "prints_failed",
    type: "int",
  },
  {
    id: "ns=1;s=Printer.LastDMC",
    tag: "printer",
    field: "last_dmc",
    type: "string",
  },
  // Scanner
  {
    id: "ns=1;s=Scanner.Status",
    tag: "scanner",
    field: "status",
    type: "string",
  },
  {
    id: "ns=1;s=Scanner.ScansTotal",
    tag: "scanner",
    field: "scans_total",
    type: "int",
  },
  {
    id: "ns=1;s=Scanner.ScansOk",
    tag: "scanner",
    field: "scans_ok",
    type: "int",
  },
  {
    id: "ns=1;s=Scanner.ScansFailed",
    tag: "scanner",
    field: "scans_failed",
    type: "int",
  },
  {
    id: "ns=1;s=Scanner.LastResult",
    tag: "scanner",
    field: "last_result",
    type: "string",
  },
  {
    id: "ns=1;s=Scanner.GradeAvg",
    tag: "scanner",
    field: "grade_avg",
    type: "float",
  },
  // Sensor
  {
    id: "ns=1;s=Sensor.Temperature",
    tag: "sensor",
    field: "temperature",
    type: "float",
  },
  {
    id: "ns=1;s=Sensor.Humidity",
    tag: "sensor",
    field: "humidity",
    type: "float",
  },
  {
    id: "ns=1;s=Sensor.Vibration",
    tag: "sensor",
    field: "vibration",
    type: "float",
  },
  {
    id: "ns=1;s=Sensor.LightBarrier",
    tag: "sensor",
    field: "light_barrier",
    type: "bool",
  },
  // Production Line
  {
    id: "ns=1;s=ProductionLine.Status",
    tag: "line",
    field: "status",
    type: "string",
  },
  {
    id: "ns=1;s=ProductionLine.PartsProduced",
    tag: "line",
    field: "parts_produced",
    type: "int",
  },
  {
    id: "ns=1;s=ProductionLine.CycleTime",
    tag: "line",
    field: "cycle_time",
    type: "float",
  },
  { id: "ns=1;s=ProductionLine.OEE", tag: "line", field: "oee", type: "float" },
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Wait for services to be ready
  console.log("Waiting for services to start...");
  await sleep(8000);

  // Connect MQTT
  const mqttClient = mqtt.connect(MQTT_BROKER);
  await new Promise((resolve, reject) => {
    mqttClient.on("connect", () => {
      console.log("Connected to MQTT broker");
      resolve();
    });
    mqttClient.on("error", reject);
  });

  // Connect InfluxDB
  const influx = new InfluxDB({ url: INFLUXDB_URL, token: INFLUXDB_TOKEN });
  const writeApi = influx.getWriteApi(INFLUXDB_ORG, INFLUXDB_BUCKET, "s", {
    writeFailed: (error, lines, attempt) => {
      console.error("Influx writeFailed", {
        attempt,
        status: error.statusCode,
        body: error.body,
        message: error.message,
        sample: lines[0],
      });
    },
    writeSuccess: (lines) => {
      console.log(
        "Influx writeSuccess, lines:",
        lines.length,
        "sample:",
        lines[0],
      );
    },
  });
  console.log("InfluxDB writer ready");

  // Connect OPC UA
  const client = OPCUAClient.create({ endpointMustExist: false });

  let connected = false;
  while (!connected) {
    try {
      await client.connect(OPCUA_ENDPOINT);
      connected = true;
      console.log("Connected to OPC UA server");
    } catch (err) {
      console.log("OPC UA not ready, retrying in 3s...", err.message);
      await sleep(3000);
    }
  }

  const session = await client.createSession();
  console.log("OPC UA session created");

  // Poll loop
  async function poll() {
    try {
      const nodesToRead = NODES.map((n) => ({
        nodeId: n.id,
        attributeId: AttributeIds.Value,
      }));

      const results = await session.read(nodesToRead);
      console.log(
        "first read:",
        results[0].statusCode?.toString(),
        "value:",
        results[0].value?.value,
      );

      const payload = {};

      for (let i = 0; i < NODES.length; i++) {
        const node = NODES[i];
        const value = results[i].value?.value;

        // Build MQTT payload grouped by tag
        if (!payload[node.tag]) payload[node.tag] = {};
        payload[node.tag][node.field] = value;

        // Write to InfluxDB
        const point = new Point(node.tag);
        if (node.type === "float") {
          point.floatField(node.field, typeof value === "number" ? value : 0);
        } else if (node.type === "int") {
          point.intField(node.field, typeof value === "number" ? value : 0);
        } else if (node.type === "bool") {
          point.booleanField(node.field, !!value);
        } else {
          point.stringField(node.field, String(value || ""));
        }
        await writeApi.writePoint(point);
      }

      // Publish to MQTT
      for (const [tag, data] of Object.entries(payload)) {
        mqttClient.publish(
          `factory/${tag}`,
          JSON.stringify({ timestamp: new Date().toISOString(), ...data }),
          { qos: 0 },
        );
      }

      await writeApi.flush().catch((msg) => console.log(`ERROR: ${msg}`));
    } catch (err) {
      console.error("Poll error:", err.message);
    }
  }

  console.log(`Polling every ${POLL_INTERVAL}ms...`);
  // setInterval(poll, POLL_INTERVAL);
  // poll();
  async function loop() {
    while (true) {
      await poll();
      await sleep(POLL_INTERVAL);
    }
  }
  loop();
}

main().catch(console.error);
