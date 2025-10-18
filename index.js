// backend/index.js
require("dotenv").config();
const express = require("express");
const { connectPostgres, connectMongo, getPostgres, getMongo } = require("./src/db");
const { connectMqtt, sendCommand } = require("./src/mqttClient"); // ✅ import sendCommand

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json()); // ✅ enable JSON parsing globally

// Root
app.get("/", (req, res) => {
  res.send("EcoSort Commander backend is running!");
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

// Test Postgres
app.get("/test-postgres", async (req, res) => {
  try {
    const pg = getPostgres();
    const out = await pg.query("SELECT NOW()");
    res.json({ postgres_time: out.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test MongoDB
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

// Return recent robot telemetry
app.get("/api/robots", async (req, res) => {
  try {
    const db = getMongo();
    const robots = await db.collection("robot_telemetry")
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    res.json(robots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a command to a robot
app.post("/api/robot/:id/command", (req, res) => {
  const robotId = req.params.id;
  const command = req.body;

  sendCommand(robotId, command);
  res.json({ ok: true, robotId, command });
});

// Start server + connect services
app.listen(PORT, async () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
  try {
    await connectPostgres();
    await connectMongo();
    connectMqtt(); // ✅ start MQTT once server is ready
  } catch (e) {
    console.error("❌ Startup error:", e.message);
  }
});