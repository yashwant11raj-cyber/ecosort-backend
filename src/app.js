// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

import robotRoutes from "./routes/robot.js";
import authRoutes from "./routes/auth.js";
import analyticsRoutes from "./routes/analytics.js";

import { createClient } from "@supabase/supabase-js";
import mqttClient from "./mqttClient.js";

dotenv.config();

const app = express();

// ✅ Middleware setup
app.use(cors());
app.use(bodyParser.json());

// ✅ Base route for quick check
app.get("/", (req, res) => {
  res.json({ message: "EcoSort backend is running smoothly 🌱" });
});

// ✅ Use route files
app.use("/api/robots", robotRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

// ✅ Supabase connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️  Missing SUPABASE_URL or SUPABASE_KEY in .env file.");
} else {
  console.log("✅ Supabase client initialized successfully.");
}

// ✅ MQTT health check
mqttClient.on("connect", () => {
  console.log("📡 MQTT client connected successfully.");
});
mqttClient.on("error", (err) => {
  console.error("❌ MQTT error:", err.message);
});

export default app;
