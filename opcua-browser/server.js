const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const {
  OPCUAClient,
  AttributeIds,
  BrowseDirection,
  NodeClass,
  resolveNodeId,
  StatusCodes,
} = require("node-opcua-client");

const OPCUA_ENDPOINT =
  process.env.OPCUA_ENDPOINT || "opc.tcp://localhost:4840/UA/Factory";
const PORT = parseInt(process.env.PORT || "8090", 10);

const NODE_CLASS_NAMES = {
  0: "Unspecified",
  1: "Object",
  2: "Variable",
  4: "Method",
  8: "ObjectType",
  16: "VariableType",
  32: "ReferenceType",
  64: "DataType",
  128: "View",
};

function nodeClassName(nc) {
  return NODE_CLASS_NAMES[nc] ?? String(nc);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let session = null;

async function connectOpcua() {
  const client = OPCUAClient.create({
    endpointMustExist: false,
    connectionStrategy: { maxRetry: -1, initialDelay: 2000, maxDelay: 5000 },
  });
  client.on("backoff", (retry, delay) =>
    console.log(`OPC UA backoff retry=${retry} delay=${delay}ms`),
  );

  while (true) {
    try {
      await client.connect(OPCUA_ENDPOINT);
      console.log(`Connected to OPC UA at ${OPCUA_ENDPOINT}`);
      session = await client.createSession();
      console.log("Session created");
      break;
    } catch (err) {
      console.log("OPC UA not ready, retrying in 3s:", err.message);
      await sleep(3000);
    }
  }

  session.on("session_closed", () => {
    console.log("Session closed");
    session = null;
  });
}

async function browseNode(nodeId) {
  if (!session) throw new Error("OPC UA session not ready");
  const browseDescription = {
    nodeId,
    referenceTypeId: "HierarchicalReferences",
    includeSubtypes: true,
    browseDirection: BrowseDirection.Forward,
    resultMask: 0x3f,
  };
  const result = await session.browse(browseDescription);
  const refs = result.references || [];
  return refs.map((r) => ({
    nodeId: r.nodeId.toString(),
    browseName: r.browseName.toString(),
    displayName: r.displayName?.text ?? r.browseName.toString(),
    nodeClass: nodeClassName(r.nodeClass),
    typeDefinition: r.typeDefinition?.toString() || null,
    isForward: r.isForward,
  }));
}

function formatValue(v) {
  if (v == null) return null;
  if (Buffer.isBuffer(v)) return v.toString("hex");
  if (Array.isArray(v)) return v.map(formatValue);
  if (typeof v === "object" && v.toString && v.constructor !== Object) {
    return v.toString();
  }
  return v;
}

async function readNode(nodeId) {
  if (!session) throw new Error("OPC UA session not ready");
  const attrs = [
    { name: "NodeId", id: AttributeIds.NodeId },
    { name: "NodeClass", id: AttributeIds.NodeClass },
    { name: "BrowseName", id: AttributeIds.BrowseName },
    { name: "DisplayName", id: AttributeIds.DisplayName },
    { name: "Description", id: AttributeIds.Description },
    { name: "DataType", id: AttributeIds.DataType },
    { name: "ValueRank", id: AttributeIds.ValueRank },
    { name: "AccessLevel", id: AttributeIds.AccessLevel },
    { name: "UserAccessLevel", id: AttributeIds.UserAccessLevel },
    { name: "Value", id: AttributeIds.Value },
  ];
  const results = await session.read(
    attrs.map((a) => ({ nodeId, attributeId: a.id })),
  );

  const out = {};
  for (let i = 0; i < attrs.length; i++) {
    const r = results[i];
    const ok = r.statusCode === StatusCodes.Good;
    if (!ok) {
      out[attrs[i].name] = null;
      continue;
    }
    const v = r.value?.value;
    if (attrs[i].name === "NodeClass") {
      out.NodeClass = nodeClassName(v);
    } else if (attrs[i].name === "BrowseName") {
      out.BrowseName = v?.toString() ?? null;
    } else if (
      attrs[i].name === "DisplayName" ||
      attrs[i].name === "Description"
    ) {
      out[attrs[i].name] = v?.text ?? null;
    } else if (attrs[i].name === "DataType") {
      out.DataType = v?.toString() ?? null;
    } else if (attrs[i].name === "Value") {
      out.Value = formatValue(v);
      out.ValueDataType = r.value?.dataType
        ? String(r.value.dataType)
        : null;
      out.SourceTimestamp = r.sourceTimestamp
        ? r.sourceTimestamp.toISOString()
        : null;
      out.ServerTimestamp = r.serverTimestamp
        ? r.serverTimestamp.toISOString()
        : null;
    } else {
      out[attrs[i].name] = formatValue(v);
    }
  }
  return out;
}

// --- HTTP server ---
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    ...headers,
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function serveStatic(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (parsed.pathname === "/" || parsed.pathname === "/index.html") {
      return serveStatic(
        res,
        path.join(__dirname, "public", "index.html"),
        "text/html; charset=utf-8",
      );
    }

    if (parsed.pathname === "/api/health") {
      return send(res, 200, {
        connected: !!session,
        endpoint: OPCUA_ENDPOINT,
      });
    }

    if (parsed.pathname === "/api/browse") {
      const nodeId = parsed.query.nodeId || "i=84";
      const children = await browseNode(nodeId);
      return send(res, 200, { nodeId, children });
    }

    if (parsed.pathname === "/api/read") {
      const nodeId = parsed.query.nodeId;
      if (!nodeId) return send(res, 400, { error: "nodeId required" });
      const attrs = await readNode(nodeId);
      return send(res, 200, { nodeId, attributes: attrs });
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("Request error:", err);
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`OPC UA Browser UI on http://0.0.0.0:${PORT}`);
});

connectOpcua().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
