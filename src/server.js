// ==========================================================
//  EcoSort Commander Backend - Production Ready for Render
// ==========================================================

import dotenv from "dotenv";
dotenv.config(); // Loads .env locally; Render injects env vars automatically

import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import mqtt from "mqtt";

import robotRoutes from "./routes/robot.js";
import authRoutes from "./routes/auth.js";
import feedbackRoutes from "./routes/feedback.js";
import analyticsRoutes from "./routes/analytics.js";

import { createClient } from "@supabase/supabase-js";

// ==========================================================
//  1️⃣ Express App Setup
// ==========================================================
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// ==========================================================
//  2️⃣ Environment Variables
// ==========================================================
const {
  NODE_ENV,
  PORT = 3001,
  POSTGRES_URL,
  MONGODB_URL,
  SUPABASE_URL,
  SUPABASE_KEY,
  MQTT_BROKER_URL,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  JWT_SECRET,
} = process.env;

// Log overview (safe, hides secrets)
console.log("🌍 Environment Summary:");
console.log({
  NODE_ENV,
  hasPostgres: !!POSTGRES_URL,
  hasMongo: !!MONGODB_URL,
  hasSupabase: !!SUPABASE_URL && !!SUPABASE_KEY,
  hasMqtt: !!MQTT_BROKER_URL,
  hasJwtSecret: !!JWT_SECRET,
});

// ==========================================================
//  3️⃣ Root & Health Routes
// ==========================================================
app.get("/", (req, res) => {
  res.send("🌱 EcoSort Commander Backend is up! Visit /api/health for details.");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "EcoSort Commander backend running fine!",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
//  4️⃣ Connect to Databases
// ==========================================================

// --- MongoDB ---
if (MONGODB_URL) {
  mongoose
    .connect(MONGODB_URL)
    .then(() => console.log("✅ MongoDB connected successfully"))
    .catch((err) =>
      console.error("❌ MongoDB connection failed:", err.message)
    );
} else {
  console.warn("⚠️  MONGODB_URL not set — skipping MongoDB connection");
}

// --- Supabase (Postgres) ---
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("⚠️  Missing SUPABASE_URL or SUPABASE_KEY in environment!");
} else {
  console.log("✅ Supabase client initialized successfully.");
}

// ==========================================================
//  5️⃣ Connect to MQTT Broker
// ==========================================================
if (MQTT_BROKER_URL) {
  const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  mqttClient.on("connect", () => {
    console.log("📡 Connected to MQTT broker!");
    mqttClient.subscribe("robots/+/status", (err) => {
      if (!err) console.log("📩 Subscribed to robot status topics");
    });
  });

  mqttClient.on("error", (err) => {
    console.error("❌ MQTT connection error:", err.message);
  });
} else {
  console.warn("⚠️  No MQTT_BROKER_URL defined — skipping MQTT connection");
}

// ==========================================================
//  6️⃣ JWT Sanity Check
// ==========================================================
if (JWT_SECRET) {
  const testToken = jwt.sign({ test: true }, JWT_SECRET, { expiresIn: "1h" });
  console.log("🔑 JWT ready. Sample token created successfully.");
} else {
  console.warn("⚠️  No JWT_SECRET provided. Tokens won’t be secure!");
}

// ==========================================================
//  7️⃣ Mount All Routes
// ==========================================================
app.use("/api/robots", robotRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/analytics", analyticsRoutes);

// ==========================================================
//  8️⃣ Start Server
// ==========================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV || "development"} mode`);
});

// ==========================================================
//  END OF FILE
// ==========================================================
