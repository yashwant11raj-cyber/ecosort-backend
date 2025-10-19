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

const app = express();
const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || "development";

// ----------------------------------------------------
// 🔒 Global security & rate limiting
// ----------------------------------------------------
app.use(express.json());
app.use(helmet());

// General rate limit for all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min window
  max: 100,                 // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Optional stricter limiter only for /api/auth
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/auth", authLimiter);

// ================================================
//  Routes
// ================================================

app.get("/", (req, res) => {
  res.send("🌱 EcoSort Commander backend is running successfully!");
});

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

// Example protected route
app.get("/api/analytics/private", requireAuth, async (req, res) => {
  res.json({
    ok: true,
    message: "Private analytics data available.",
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});
