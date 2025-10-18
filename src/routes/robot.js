// src/routes/robot.js
import express from "express";
import mongoose from "mongoose";
import RobotTelemetry from "../models/RobotTelemetry.js";

const router = express.Router();

// GET /api/robots – return all robots
router.get("/", async (req, res) => {
  try {
    const robots = await RobotTelemetry.find();
    res.json(robots);
  } catch (err) {
    console.error("Error fetching robots:", err.message);
    res.status(500).json({ message: "Failed to fetch robots" });
  }
});

// GET /api/robots/:id – single robot
router.get("/:id", async (req, res) => {
  try {
    const robot = await RobotTelemetry.findOne({ robot_id: req.params.id });
    if (!robot) return res.status(404).json({ message: "Robot not found" });
    res.json(robot);
  } catch (err) {
    console.error("Error fetching robot:", err.message);
    res.status(500).json({ message: "Failed to fetch robot" });
  }
});

// ✅ Export properly for ES modules
export default router;
