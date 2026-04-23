const {
  OPCUAServer,
  DataType,
  Variant,
  StatusCodes,
  UAMethod,
} = require("node-opcua");
const http = require("http");

// --- Simulated machine state ---
const machines = {
  printer: {
    status: "idle", // idle, printing, error
    temperature: 22.0,
    printsTotal: 0,
    printsOk: 0,
    printsFailed: 0,
    lastDMC: "",
    speed: 120, // prints per hour
  },
  scanner: {
    status: "idle", // idle, scanning, error
    scansTotal: 0,
    scansOk: 0,
    scansFailed: 0,
    lastResult: "",
    gradeAvg: 0.0,
  },
  sensor: {
    temperature: 23.5,
    humidity: 45.0,
    vibration: 0.02,
    lightBarrier: false,
  },
  line: {
    status: "stopped", // stopped, running, paused
    partsProduced: 0,
    cycleTime: 3.0, // seconds
    oee: 0.0,
  },
};

// --- Event log ---
const eventLog = [];
function logEvent(source, type, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    source,
    type,
    message,
  };
  eventLog.push(entry);
  if (eventLog.length > 200) eventLog.shift();
  return entry;
}

// --- Simulation logic ---
let simulationInterval = null;

function startSimulation() {
  if (simulationInterval) return;
  machines.line.status = "running";
  logEvent("line", "info", "Production line started");

  simulationInterval = setInterval(() => {
    // Sensor noise
    machines.sensor.temperature = 23.5 + (Math.random() - 0.5) * 2;
    machines.sensor.humidity = 45 + (Math.random() - 0.5) * 10;
    machines.sensor.vibration = 0.02 + Math.random() * 0.03;

    // Printer temperature drift
    machines.printer.temperature =
      22 + Math.sin(Date.now() / 30000) * 3 + (Math.random() - 0.5);

    // Simulate print cycle
    if (
      machines.line.status === "running" &&
      machines.printer.status === "idle"
    ) {
      machines.printer.status = "printing";
      machines.sensor.lightBarrier = true;

      setTimeout(() => {
        machines.printer.printsTotal++;
        const success = Math.random() > 0.05;
        const dmc = `DMC-${Date.now().toString(36).toUpperCase()}`;

        if (success) {
          machines.printer.printsOk++;
          machines.printer.lastDMC = dmc;
          machines.printer.status = "idle";
          logEvent("printer", "info", `Print OK: ${dmc}`);

          // Trigger scan
          machines.scanner.status = "scanning";
          setTimeout(() => {
            machines.scanner.scansTotal++;
            const grade = 2.5 + Math.random() * 1.5;
            const scanOk = grade < 3.5;

            if (scanOk) {
              machines.scanner.scansOk++;
              machines.scanner.lastResult = "PASS";
              logEvent(
                "scanner",
                "info",
                `Scan PASS: ${dmc} (grade ${grade.toFixed(1)})`,
              );
            } else {
              machines.scanner.scansFailed++;
              machines.scanner.lastResult = "FAIL";
              logEvent(
                "scanner",
                "warning",
                `Scan FAIL: ${dmc} (grade ${grade.toFixed(1)})`,
              );
            }
            machines.scanner.gradeAvg =
              machines.scanner.scansTotal > 0
                ? (machines.scanner.gradeAvg *
                    (machines.scanner.scansTotal - 1) +
                    grade) /
                  machines.scanner.scansTotal
                : grade;
            machines.scanner.status = "idle";
            machines.line.partsProduced++;
            machines.sensor.lightBarrier = false;

            // Update OEE
            const availability =
              machines.line.status === "running" ? 0.95 : 0.0;
            const performance =
              machines.printer.speed > 0
                ? Math.min(
                    1,
                    machines.line.partsProduced /
                      (machines.printer.speed * 0.5),
                  )
                : 0;
            const quality =
              machines.printer.printsTotal > 0
                ? machines.printer.printsOk / machines.printer.printsTotal
                : 1;
            machines.line.oee = availability * performance * quality;
          }, 800);
        } else {
          machines.printer.printsFailed++;
          machines.printer.status = "error";
          machines.printer.lastDMC = "";
          logEvent("printer", "error", "Print FAILED, nozzle issue detected");

          // Auto-recover after 5s
          setTimeout(() => {
            machines.printer.status = "idle";
            logEvent("printer", "info", "Printer recovered from error");
          }, 5000);
        }
      }, 1200);
    }

    // Cycle time jitter
    machines.line.cycleTime = 3.0 + (Math.random() - 0.5) * 0.4;
  }, 3000);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  machines.line.status = "stopped";
  machines.printer.status = "idle";
  machines.scanner.status = "idle";
  logEvent("line", "info", "Production line stopped");
}

function triggerError(machine) {
  if (machines[machine]) {
    machines[machine].status = "error";
    logEvent(machine, "error", `Manual error triggered on ${machine}`);
    setTimeout(() => {
      machines[machine].status = "idle";
      logEvent(machine, "info", `${machine} recovered from manual error`);
    }, 8000);
  }
}

// --- OPC UA Server ---
async function startOPCUAServer() {
  const server = new OPCUAServer({
    port: 4840,
    resourcePath: "/UA/Factory",
    alternateHostname: ["opcua-server", "localhost"],
    buildInfo: {
      productName: "Senodis Factory Demo",
      buildNumber: "1.0.0",
      buildDate: new Date(),
    },
  });

  await server.initialize();

  const addressSpace = server.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace();

  // --- Printer Node ---
  const printerObj = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "Printer",
  });

  function addVar(parent, name, dataType, getter) {
    namespace.addVariable({
      componentOf: parent,
      nodeId: `s=${parent.browseName.name}.${name}`,
      browseName: name,
      dataType,
      value: {
        get: () =>
          new Variant({ dataType: DataType[dataType], value: getter() }),
      },
    });
  }

  addVar(printerObj, "Status", "String", () => machines.printer.status);
  addVar(
    printerObj,
    "Temperature",
    "Double",
    () => machines.printer.temperature,
  );
  addVar(
    printerObj,
    "PrintsTotal",
    "Int32",
    () => machines.printer.printsTotal,
  );
  addVar(printerObj, "PrintsOk", "Int32", () => machines.printer.printsOk);
  addVar(
    printerObj,
    "PrintsFailed",
    "Int32",
    () => machines.printer.printsFailed,
  );
  addVar(printerObj, "LastDMC", "String", () => machines.printer.lastDMC);
  addVar(printerObj, "Speed", "Int32", () => machines.printer.speed);

  // --- Scanner Node ---
  const scannerObj = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "Scanner",
  });

  addVar(scannerObj, "Status", "String", () => machines.scanner.status);
  addVar(scannerObj, "ScansTotal", "Int32", () => machines.scanner.scansTotal);
  addVar(scannerObj, "ScansOk", "Int32", () => machines.scanner.scansOk);
  addVar(
    scannerObj,
    "ScansFailed",
    "Int32",
    () => machines.scanner.scansFailed,
  );
  addVar(scannerObj, "LastResult", "String", () => machines.scanner.lastResult);
  addVar(scannerObj, "GradeAvg", "Double", () => machines.scanner.gradeAvg);

  // --- Sensor Node ---
  const sensorObj = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "Sensor",
  });

  addVar(sensorObj, "Temperature", "Double", () => machines.sensor.temperature);
  addVar(sensorObj, "Humidity", "Double", () => machines.sensor.humidity);
  addVar(sensorObj, "Vibration", "Double", () => machines.sensor.vibration);
  addVar(
    sensorObj,
    "LightBarrier",
    "Boolean",
    () => machines.sensor.lightBarrier,
  );

  // --- Line Node ---
  const lineObj = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "ProductionLine",
  });

  addVar(lineObj, "Status", "String", () => machines.line.status);
  addVar(lineObj, "PartsProduced", "Int32", () => machines.line.partsProduced);
  addVar(lineObj, "CycleTime", "Double", () => machines.line.cycleTime);
  addVar(lineObj, "OEE", "Double", () => machines.line.oee);

  await server.start();
  console.log("OPC UA Server running on port 4840");
  const endpoints = server.endpoints[0].endpointDescriptions();
  console.log("Endpoint:");
  for (const e of endpoints) console.log("  -", e.endpointUrl);

  // Start simulation automatically
  startSimulation();
}

// --- Simple HTTP API for triggering events ---
const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/status" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ machines, eventLog: eventLog.slice(-50) }));
    return;
  }

  if (req.url === "/api/start" && req.method === "POST") {
    startSimulation();
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: "Line started" }));
    return;
  }

  if (req.url === "/api/stop" && req.method === "POST") {
    stopSimulation();
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: "Line stopped" }));
    return;
  }

  if (req.url === "/api/error/printer" && req.method === "POST") {
    triggerError("printer");
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: "Printer error triggered" }));
    return;
  }

  if (req.url === "/api/error/scanner" && req.method === "POST") {
    triggerError("scanner");
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: "Scanner error triggered" }));
    return;
  }

  if (req.url === "/api/events" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify(eventLog.slice(-100)));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(3001, () => {
  console.log("HTTP API running on port 3001");
});

startOPCUAServer().catch(console.error);
