// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

import robotRoutes from "./routes/robot.js";
import authRoutes from "./routes/auth.js";
import analyticsRoutes from "./routes/analytics.js";

import { createClient } from "@supabase/supabase-js";
import * as mqttModule from "./mqttClient.js";

dotenv.config();

const app = express();

// ✅ Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Base route for quick check
app.get("/", (req, res) => {
  res.json({ message: "EcoSort backend is running smoothly 🌱" });
});

// ✅ API routes
app.use("/api/robots", robotRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

// ✅ Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️ Missing SUPABASE_URL or SUPABASE_KEY in environment!");
} else {
  console.log("✅ Supabase client initialized successfully.");
}

// ✅ Initialize MQTT after import
let mqttClient = null;

try {
  if (mqttModule.mqttClient) {
    mqttClient = mqttModule.mqttClient;
  } else if (mqttModule.default) {
    mqttClient = mqttModule.default;
  } else {
    console.warn("⚠️ mqttClient not found in mqttClient.js export.");
  }

  if (mqttClient) {
    mqttClient.on("connect", () => {
      console.log("📡 MQTT client connected successfully.");
    });

    mqttClient.on("error", (err) => {
      console.error("❌ MQTT error:", err.message);
    });
  }
} catch (err) {
  console.error("❌ Failed to initialize MQTT client:", err.message);
}

export default app;
