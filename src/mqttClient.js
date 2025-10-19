// ===============================================
// src/mqttClient.js
// Handles all MQTT communication for EcoSort
// ===============================================

import mqtt from "mqtt";
import { getMongo, getPostgres } from "./db.js";

// ------------------------------------------------
// Environment / connection config
// ------------------------------------------------
const BROKER_URL =
  process.env.MQTT_BROKER_URL || "mqtt://broker.hivemq.com:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

// Shared client instance
export let mqttClient = null;

// ------------------------------------------------
// Connect to broker (idempotent)
// ------------------------------------------------
export function connectMqtt() {
  if (mqttClient) return mqttClient;

  console.log("🔗 Connecting to MQTT broker...");

  mqttClient = mqtt.connect(BROKER_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    reconnectPeriod: 2000,
    keepalive: 20,
  });

  mqttClient.on("connect", () => console.log("✅ MQTT connected"));
  mqttClient.on("reconnect", () => console.log("♻️ MQTT reconnecting..."));
  mqttClient.on("error", (err) =>
    console.error("❌ MQTT error:", err.message)
  );

  return mqttClient;
}

// ------------------------------------------------
// Subscribe to telemetry topic ecosort/+/telemetry
// ------------------------------------------------
export function subscribeTelemetry() {
  if (!mqttClient) connectMqtt();

  const topic = "ecosort/+/telemetry";
  mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
    if (err) return console.error("❌ Subscribe error:", err.message);
    console.log(`📡 Subscribed to ${topic}`, granted);
  });

  mqttClient.on("message", async (topic, payload) => {
    try {
      if (!topic.match(/^ecosort\/[^/]+\/telemetry$/)) return; // ignore others
      const json = JSON.parse(payload.toString());
      const doc = normalizeTelemetry(topic, json);
      await saveTelemetryMongo(doc);          // raw log
      await upsertTelemetryRollupPG(doc);     // summary
    } catch (e) {
      console.error("❌ Telemetry handling error:", e.message);
    }
  });
}

// ------------------------------------------------
// Helpers
// ------------------------------------------------
function normalizeTelemetry(topic, msg) {
  const [, robotId] = topic.split("/");
  const doc = {
    robot_id: msg.robot_id || robotId,
    battery: toInt(msg.battery, 0),
    bin_status: isObj(msg.bin_status) ? msg.bin_status : {},
    sorted_count: toInt(msg.sorted_count, 0),
    low_confidence: toInt(msg.low_confidence, 0),
    ts: isISO(msg.ts) ? msg.ts : new Date().toISOString(),
    _ingested_at: new Date().toISOString(),
  };
  doc.battery = Math.min(100, Math.max(0, doc.battery));
  return doc;
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
function toInt(v, d = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}
function isISO(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);
}

// ------------------------------------------------
// Mongo insert (raw telemetry)
// ------------------------------------------------
async function saveTelemetryMongo(doc) {
  const db = getMongo();
  await db.collection("telemetry").insertOne(doc);
}

// ------------------------------------------------
// Postgres rollup (minute bucket)
// ------------------------------------------------
async function upsertTelemetryRollupPG(doc) {
  const pg = getPostgres();
  const ts = new Date(doc.ts);
  ts.setSeconds(0, 0);
  const bucket = ts.toISOString();

  await pg.query(
    `
      INSERT INTO robot_stats_minute
        (robot_id, bucket_ts, last_battery, last_sorted_count, last_low_confidence)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (robot_id, bucket_ts)
      DO UPDATE SET
        last_battery = EXCLUDED.last_battery,
        last_sorted_count = EXCLUDED.last_sorted_count,
        last_low_confidence = EXCLUDED.last_low_confidence
    `,
    [doc.robot_id, bucket, doc.battery, doc.sorted_count, doc.low_confidence]
  );
}

// ------------------------------------------------
// Publish robot command (used by /api/robot/:id/command)
// ------------------------------------------------
export function sendCommand(robotId, command) {
  if (!mqttClient) {
    console.warn("⚠️ MQTT not connected");
    return;
  }
  const topic = `ecosort/${robotId}/commands`;
  const message = JSON.stringify(command);
  mqttClient.publish(topic, message, { qos: 1, retain: false }, (err) => {
    if (err)
      console.error("❌ Publish error:", err.message);
    else console.log(`📨 Command → ${topic}: ${message}`);
  });
}

export default { connectMqtt, subscribeTelemetry, sendCommand, mqttClient };
