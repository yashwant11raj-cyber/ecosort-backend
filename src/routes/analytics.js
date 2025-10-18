// src/routes/analytics.js
import express from "express";
import RobotTelemetry from "../models/RobotTelemetry.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// ✅ Initialize Supabase client safely
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️ Missing SUPABASE_URL or SUPABASE_KEY in .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey || "");

// ✅ Route 1: Sustainability Analytics (for Dashboard KPIs)
router.get("/sustainability", async (req, res) => {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase credentials not configured" });
    }

    // Fetch all rows from Supabase waste_logs
    const { data, error } = await supabase
      .from("waste_logs")
      .select("weight_kg, waste_type");

    if (error) {
      console.error("❌ Supabase fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch sustainability data" });
    }

    // Handle no data case
    if (!data || data.length === 0) {
      return res.json({
        total_waste_processed: 0,
        total_co2_saved: 0,
        total_landfill_saved: 0,
        total_energy_recovered: 0,
      });
    }

    // Aggregate totals and compute derived values
    const totals = data.reduce(
      (acc, row) => {
        const weight = parseFloat(row.weight_kg) || 0;
        acc.total_waste_processed += weight;
        acc.total_co2_saved += weight * 1.5; // 1.5 kg CO₂ saved per kg
        acc.total_landfill_saved += weight * 0.002; // 0.002 m³ saved per kg
        acc.total_energy_recovered += weight * 0.8; // 0.8 kWh recovered per kg
        return acc;
      },
      {
        total_waste_processed: 0,
        total_co2_saved: 0,
        total_landfill_saved: 0,
        total_energy_recovered: 0,
      }
    );

    return res.json(totals);
  } catch (err) {
    console.error("🔥 Analytics route error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Route 2: Robot Telemetry Data (MongoDB)
router.get("/telemetry", async (req, res) => {
  try {
    const telemetry = await RobotTelemetry.find().sort({ timestamp: -1 }).limit(10);
    res.json(telemetry);
  } catch (err) {
    console.error("🔥 Telemetry fetch error:", err.message);
    res.status(500).json({ error: "Failed to load telemetry data" });
  }
});

// GET /api/analytics/by-type
router.get("/by-type", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("waste_logs")
      .select("waste_type, weight_kg");

    if (error) return res.status(500).json({ error: "Fetch error" });

    const byType = {};
    for (const row of data || []) {
      const w = parseFloat(row.weight_kg) || 0;
      const t = row.waste_type || "unknown";
      byType[t] = (byType[t] || 0) + w;
    }
    res.json(byType);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/by-type
router.get("/by-type", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("waste_logs")
      .select("waste_type, weight_kg");

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch breakdown" });
    }

    const byType = {};
    for (const row of data || []) {
      const type = row.waste_type || "unknown";
      const weight = parseFloat(row.weight_kg) || 0;
      byType[type] = (byType[type] || 0) + weight;
    }

    res.json(byType);
  } catch (err) {
    console.error("Error in /by-type:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
