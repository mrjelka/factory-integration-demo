const mqtt = require("mqtt");

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://localhost:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "factory/#";

const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => {
  console.log(`Connected to ${MQTT_BROKER}`);
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) {
      console.error("Subscribe failed:", err.message);
      process.exit(1);
    }
    console.log(`Subscribed to ${MQTT_TOPIC}`);
  });
});

client.on("message", (topic, payload) => {
  console.log(`[${topic}] ${payload.toString()}`);
});

client.on("error", (err) => {
  console.error("MQTT error:", err.message);
});
