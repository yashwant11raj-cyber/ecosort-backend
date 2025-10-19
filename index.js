// ================================================
// EcoSort Commander Backend - Production Build
// ================================================

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./src/middlewares/authMiddleware.js";
import { connectPostgres, connectMongo, getPostgres, getMongo } from "./src/db.js";

// MQTT Client (handles both ESM and CommonJS export styles)
import * as mqttClientModule from "./src/mqttClient.js";
const connectMqtt =
  mqttClientModule.connectMqtt || mqttClientModule.default?.connectMqtt;
const sendCommand =
  mqttClientModule.sendCommand || mqttClientModule.default?.sendCommand;

// ----------------------------------------------------
// Express setup
// ----------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3001; // ✅ Let Render assign the port dynamically
const NODE_ENV = process.env.NODE_ENV || "development";

// ----------------------------------------------------
// 🔒 Global security & rate limiting
// ----------------------------------------------------
app.use(express.json());
app.use(helmet());

// General rate limit for all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 100, // each IP can make 100 requests
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Optional stricter limiter only for /api/auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});
app.use("/api/auth", authLimiter);

// ================================================
//  Routes
// ================================================

// Root route
app.get("/", (req, res) => {
  res.send("🌱 EcoSort Commander backend is running successfully!");
});

// Health check route
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

// Example protected route (JWT required)
app.get("/api/analytics/private", requireAuth, async (req, res) => {
  res.json({
    ok: true,
    message: "Private analytics data available.",
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// Test Postgres connection
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
// Test MongoDB connection
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
app.listen(PORT, "0.0.0.0", async () => {
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
