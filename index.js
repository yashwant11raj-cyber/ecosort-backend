// backend/index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";

// Import database helpers (ESM-compatible)
import { connectPostgres, connectMongo, getPostgres, getMongo } from "./src/db.js";

// Import MQTT client — support both CommonJS and ESM exports
import * as mqttClientModule from "./src/mqttClient.js";
const connectMqtt =
  mqttClientModule.connectMqtt || mqttClientModule.default?.connectMqtt;
const sendCommand =
  mqttClientModule.sendCommand || mqttClientModule.default?.sendCommand;

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json());

// ----------------------------------------------------
// Root route
// ----------------------------------------------------
app.get("/", (req, res) => {
  res.send("EcoSort Commander backend is running successfully 🚀");
});

// ----------------------------------------------------
// Health check route
// ----------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// Test Postgres
// ----------------------------------------------------
app.get("/test-postgres", async (req, res) => {
  try {
    const pg = getPostgres();
    const out = await pg.query("SELECT NOW()");
    res.json({ postgres_time: out.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Test MongoDB
// ----------------------------------------------------
app.get("/test-mongo", async (req, res) => {
  try {
    const db = getMongo();
    const col = db.collection("test");
    await col.updateOne(
      { _id: "heartbeat" },
      { $set: { lastPing: new Date().toISOString() } },
      { upsert: true }
    );
    const doc = await col.findOne({ _id: "heartbeat" });
    res.json({ mongo_heartbeat: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Recent robot telemetry
// ----------------------------------------------------
app.get("/api/robots", async (req, res) => {
  try {
    const db = getMongo();
    const robots = await db
      .collection("robot_telemetry")
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    res.json(robots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Send command to robot
// ----------------------------------------------------
app.post("/api/robot/:id/command", (req, res) => {
  const robotId = req.params.id;
  const command = req.body;

  if (typeof sendCommand === "function") {
    sendCommand(robotId, command);
  } else {
    console.warn("⚠️ sendCommand is not defined — check mqttClient.js exports.");
  }

  res.json({ ok: true, robotId, command });
});

// ----------------------------------------------------
// Start server + connect services
// ----------------------------------------------------
app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);
  try {
    await connectPostgres();
    await connectMongo();

    if (typeof connectMqtt === "function") {
      connectMqtt();
      console.log("📡 MQTT connection initialized.");
    } else {
      console.warn("⚠️ connectMqtt not found — skipping MQTT init.");
    }
  } catch (e) {
    console.error("❌ Startup error:", e.message);
  }
});
