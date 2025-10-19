// ================================================
// EcoSort Commander Backend - Production Build
// ================================================

// 1️⃣ Load Environment Variables
import dotenv from "dotenv";
dotenv.config();

// 2️⃣ Core Dependencies
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// 3️⃣ Database helpers
import { connectPostgres, connectMongo, getPostgres, getMongo } from "./src/db.js";

// 4️⃣ MQTT Client (handles both ESM and CommonJS export styles)
import * as mqttClientModule from "./src/mqttClient.js";
const connectMqtt =
  mqttClientModule.connectMqtt || mqttClientModule.default?.connectMqtt;
const sendCommand =
  mqttClientModule.sendCommand || mqttClientModule.default?.sendCommand;

// 5️⃣ Express App Setup
const app = express();
const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || "development";

app.use(express.json());
app.use(helmet()); // security headers
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ================================================
//  Routes
// ================================================

// Root
app.get("/", (req, res) => {
  res.send("🌱 EcoSort Commander backend is running successfully!");
});

// Health check (with version, uptime, and environment)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ecosort-backend",
    version: "1.0.0",
    uptime_seconds: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
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
    console.error("[Postgres] Error:", err.message);
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
    console.error("[MongoDB] Error:", err.message);
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
    console.error("[Robots] Error:", err.message);
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
    console.log(`📡 Command sent to ${robotId}:`, command);
  } else {
    console.warn("⚠️ sendCommand is not defined — check mqttClient.js exports.");
  }

  res.json({ ok: true, robotId, command });
});

// ================================================
//  Startup Logic
// ================================================
app.listen(PORT, async () => {
  console.log("===============================================");
  console.log(`🚀 EcoSort Backend Live on Port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log("===============================================");

  try {
    console.log("🔗 Connecting to Postgres...");
    await connectPostgres();
    console.log("✅ Postgres connected.");

    console.log("🔗 Connecting to MongoDB...");
    await connectMongo();
    console.log("✅ MongoDB connected.");

    if (typeof connectMqtt === "function") {
      console.log("🔗 Connecting to MQTT broker...");
      connectMqtt();
      console.log("✅ MQTT connection initialized.");
    } else {
      console.warn("⚠️ connectMqtt not found — skipping MQTT init.");
    }
  } catch (e) {
    console.error("❌ Startup error:", e.message);
  }
});
