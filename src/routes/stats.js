// ===============================================
// src/routes/stats.js
// Analytics API for EcoSort Commander (Fixed version)
// ===============================================

import express from "express";
import { getPostgres, getMongo } from "../db.js";

const router = express.Router();

function parseWindow(q) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from
    ? new Date(q.from)
    : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new Error("Invalid from/to format. Use ISO timestamps.");
  }
  return { from, to };
}

// ------------------------------------------------------------
// GET /api/stats/overview
// ------------------------------------------------------------
router.get("/overview", async (req, res) => {
  try {
    const { from, to } = parseWindow(req.query);
    const pg = getPostgres();

    // Fixed: renamed CTE from 'window' to 'time_window'
    const { rows } = await pg.query(
      `
      WITH time_window AS (
        SELECT $1::timestamptz AS from_ts, $2::timestamptz AS to_ts
      ),
      series AS (
        SELECT robot_id, bucket_ts, last_sorted_count, last_battery
        FROM robot_stats_minute
        WHERE bucket_ts BETWEEN (SELECT from_ts FROM time_window)
                            AND (SELECT to_ts FROM time_window)
      ),
      per_robot AS (
        SELECT
          robot_id,
          (MAX(last_sorted_count) - MIN(last_sorted_count))::int AS items_sorted,
          AVG(last_battery)::int AS avg_battery
        FROM series
        GROUP BY robot_id
      )
      SELECT
        COALESCE(SUM(items_sorted), 0)::int AS total_items_sorted,
        COALESCE(AVG(avg_battery), 0)::int AS avg_battery_overall,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'robot_id', robot_id,
              'items_sorted', items_sorted,
              'avg_battery', avg_battery
            )
            ORDER BY robot_id
          ) FILTER (WHERE robot_id IS NOT NULL),
          '[]'::json
        ) AS per_robot
      FROM per_robot;
      `,
      [from.toISOString(), to.toISOString()]
    );

    const overview = rows[0] || {
      total_items_sorted: 0,
      avg_battery_overall: 0,
      per_robot: [],
    };

    const db = getMongo();
    const latest = await db
      .collection("telemetry")
      .aggregate([
        {
          $match: {
            ts: { $gte: new Date(from), $lte: new Date(to) },
          },
        },
        { $sort: { ts: -1 } },
        {
          $group: {
            _id: "$robot_id",
            latest: { $first: "$$ROOT" },
          },
        },
        {
          $project: {
            _id: 0,
            robot_id: "$_id",
            battery: "$latest.battery",
            bin_status: "$latest.bin_status",
            ts: "$latest.ts",
          },
        },
        { $sort: { robot_id: 1 } },
      ])
      .toArray();

    res.json({
      ok: true,
      window: { from: from.toISOString(), to: to.toISOString() },
      total_items_sorted: Number(overview.total_items_sorted) || 0,
      avg_battery_overall: Number(overview.avg_battery_overall) || 0,
      per_robot: overview.per_robot || [],
      latest,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ------------------------------------------------------------
// GET /api/stats/robot/:id
// ------------------------------------------------------------
router.get("/robot/:id", async (req, res) => {
  try {
    const robotId = req.params.id;
    if (!robotId) throw new Error("Missing robot id.");

    const { from, to } = parseWindow(req.query);
    const pg = getPostgres();

    const { rows } = await pg.query(
      `
      SELECT bucket_ts, last_battery, last_sorted_count
      FROM robot_stats_minute
      WHERE robot_id = $1
        AND bucket_ts BETWEEN $2 AND $3
      ORDER BY bucket_ts ASC;
      `,
      [robotId, from.toISOString(), to.toISOString()]
    );

    const points = [];
    let prev = null;
    for (const r of rows) {
      const ts = r.bucket_ts;
      const battery = r.last_battery ?? null;
      const sorted = r.last_sorted_count ?? null;
      let perMin = null;
      if (prev != null && sorted != null && prev.sorted != null) {
        perMin = Math.max(0, sorted - prev.sorted);
      }
      points.push({
        ts,
        battery,
        sorted_count: sorted,
        items_per_minute: perMin,
      });
      prev = { sorted };
    }

    // Fixed: renamed 'window' to 'time_window'
    const { rows: sRows } = await pg.query(
      `
      WITH time_window AS (
        SELECT $2::timestamptz AS from_ts, $3::timestamptz AS to_ts
      ),
      series AS (
        SELECT bucket_ts, last_sorted_count, last_battery
        FROM robot_stats_minute
        WHERE robot_id = $1
          AND bucket_ts BETWEEN (SELECT from_ts FROM time_window)
                           AND (SELECT to_ts FROM time_window)
      )
      SELECT
        COALESCE(MAX(last_sorted_count) - MIN(last_sorted_count), 0)::int AS items_sorted,
        COALESCE(AVG(last_battery), 0)::int AS avg_battery
      FROM series;
      `,
      [robotId, from.toISOString(), to.toISOString()]
    );

    const summary = sRows[0] || { items_sorted: 0, avg_battery: 0 };

    res.json({
      ok: true,
      robot_id: robotId,
      window: { from: from.toISOString(), to: to.toISOString() },
      summary,
      points,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
