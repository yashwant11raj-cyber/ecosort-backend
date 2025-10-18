// src/models/RobotTelemetry.js
import mongoose from "mongoose";

const robotTelemetrySchema = new mongoose.Schema(
  {
    robot_id: { type: String, required: true, unique: true },
    status: { type: String, default: "idle" },
    battery_level: { type: Number, default: 100 },
    location: {
      type: [Number], // [lat, lon]
      default: [1.3521, 103.8198], // Singapore
    },
    last_update: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ✅ Define and export the model properly for ES modules
const RobotTelemetry = mongoose.model("RobotTelemetry", robotTelemetrySchema);
export default RobotTelemetry;
