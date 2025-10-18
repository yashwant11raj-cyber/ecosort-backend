// src/mqttClient.js
import mqtt from "mqtt";
import { supabase } from "./app.js";
import RobotTelemetry from "./models/RobotTelemetry.js";

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  reconnectPeriod: 2000,
});

client.on("connect", () => {
  console.log("✅ MQTT connected");
  client.subscribe("ecosort/robot/+/status");
});

client.on("reconnect", () => console.log("♻️ MQTT reconnecting..."));
client.on("error", (err) => console.error("❌ MQTT connection error:", err.message));

client.on("message", async (topic, buf) => {
  try {
    const payload = JSON.parse(buf.toString());
    console.log("📩 MQTT data:", payload);

    // Save to MongoDB (if model connected)
    await RobotTelemetry.create({
      robot_id: payload.robot_id,
      status: payload.status,
      battery_level: payload.battery_level,
      timestamp: new Date(),
    });

    // Sustainability calculation
    const co2 = (payload.weight || 0) * 1.5;
    const landfill = (payload.weight || 0) * 0.002;
    const energy = (payload.weight || 0) * 0.8;

    // Insert into Supabase
    const { error } = await supabase.from("waste_logs").insert([
      {
        robot_id: payload.robot_id,
        weight: payload.weight ?? 0,
        co2_saved: co2,
        landfill_saved: landfill,
        energy_recovered: energy,
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) console.error("Supabase insert error:", error.message);
    else console.log("✅ Saved sustainability data to Supabase");
  } catch (e) {
    console.error("⚠️ MQTT parse error:", e.message);
  }
});

export default client;
