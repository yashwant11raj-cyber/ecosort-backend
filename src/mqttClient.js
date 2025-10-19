// src/mqttClient.js
import mqtt from "mqtt";

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://test.mosquitto.org:1883";
const username = process.env.MQTT_USERNAME || "";
const password = process.env.MQTT_PASSWORD || "";

// Create a reusable client connection
export let mqttClient = null;

// Function to connect to the broker
export function connectMqtt() {
  if (mqttClient) return mqttClient; // reuse if already connected

  console.log("🔗 Connecting to MQTT broker...");

  mqttClient = mqtt.connect(brokerUrl, {
    username,
    password,
    reconnectPeriod: 2000, // auto-reconnect every 2s
  });

  mqttClient.on("connect", () => {
    console.log("✅ MQTT connected");
  });

  mqttClient.on("reconnect", () => {
    console.log("♻️ Reconnecting to MQTT broker...");
  });

  mqttClient.on("error", (err) => {
    console.error("❌ MQTT connection error:", err.message);
  });

  return mqttClient;
}

// Function to send commands to a robot
export function sendCommand(robotId, command) {
  if (!mqttClient) {
    console.warn("⚠️ MQTT not connected; cannot send command");
    return;
  }

  const topic = `robots/${robotId}/commands`;
  const message = JSON.stringify(command);

  mqttClient.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error("❌ Failed to publish command:", err.message);
    } else {
      console.log(`📡 Command sent to ${topic}: ${message}`);
    }
  });
}

// Optionally auto-connect when this module is imported
connectMqtt();

export default { connectMqtt, sendCommand, mqttClient };
