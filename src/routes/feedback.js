// src/routes/feedback.js
import express from "express";
import { connectPostgres, getPostgres } from "../db.js";

const router = express.Router();

// Connect once and reuse
let pool;
(async () => {
  pool = await connectPostgres();
})();

// 🔹 Health check
router.get("/", async (req, res) => {
  res.status(200).json({ message: "Feedback API running" });
});

// 🔹 POST /api/feedback  → store new feedback from the app
router.post("/", async (req, res) => {
  const { robot_id, original_prediction, correct_label, image_data } = req.body;

  if (!robot_id || !original_prediction || !correct_label || !image_data) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `INSERT INTO feedback_logs 
        (robot_id, original_prediction, correct_label, image_base64, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [robot_id, original_prediction, correct_label, image_data]
    );
    res.status(200).json({ message: "✅ Feedback stored successfully" });
  } catch (err) {
    console.error("❌ Error saving feedback:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

// 🔹 GET /api/feedback/all  → view all feedbacks
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM feedback_logs ORDER BY created_at DESC"
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error retrieving feedback:", err);
    res.status(500).json({ error: "Failed to fetch feedback data" });
  }
});

// 🔹 GET /api/feedback/export  → export dataset for retraining (Step 3.5)
router.get("/export", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        robot_id,
        original_prediction,
        correct_label,
        image_base64,
        created_at
      FROM feedback_logs
      ORDER BY created_at DESC
    `);

    // Set proper headers for file download
    res.header("Content-Type", "application/json");
    res.header(
      "Content-Disposition",
      "attachment; filename=feedback_export.json"
    );
    res.status(200).send(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("❌ Export error:", err);
    res.status(500).json({ error: "Failed to export feedback data" });
  }
});

export default router;
