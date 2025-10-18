// src/db.js
import dotenv from "dotenv";
import pkg from "pg";
import { MongoClient } from "mongodb";

dotenv.config();
const { Pool } = pkg;

let pgPool;

/* -------------------------------------------------------------------------- */
/*                               POSTGRES (SUPABASE)                          */
/* -------------------------------------------------------------------------- */

async function initPostgresPool() {
  console.log("🔗 Connecting to Postgres...");
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  // Catch pool-level errors before they crash Node
  pool.on("error", (err) => {
    console.error("⚠️  Postgres connection error:", err.message);
    reconnectPostgres(); // try again automatically
  });

  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Postgres connected. Server time:", res.rows[0].now);
  } catch (e) {
    console.error("❌ Initial connection failed:", e.message);
  }

  // Keep-alive ping every 30 s to prevent Supabase sleep
  setInterval(async () => {
    try {
      await pool.query("SELECT 1");
    } catch (e) {
      console.warn("[Postgres] keep-alive failed:", e.message);
      reconnectPostgres();
    }
  }, 30_000);

  return pool;
}

async function reconnectPostgres() {
  try {
    if (pgPool) {
      console.log("🧹 Closing old pool...");
      await pgPool.end().catch(() => {});
    }
  } catch (_) {}
  console.log("🔁 Reconnecting to Postgres in 10 s...");
  setTimeout(async () => {
    try {
      pgPool = await initPostgresPool();
    } catch (e) {
      console.error("❌ Reconnect failed:", e.message);
      reconnectPostgres();
    }
  }, 10_000);
}

export async function connectPostgres() {
  if (!pgPool) pgPool = await initPostgresPool();
  return pgPool;
}

export function getPostgres() {
  if (!pgPool) throw new Error("Postgres not connected yet");
  return pgPool;
}

/* -------------------------------------------------------------------------- */
/*                                 MONGODB                                    */
/* -------------------------------------------------------------------------- */

let mongoClient, mongoDb;

export async function connectMongo() {
  if (mongoDb) return mongoDb;
  mongoClient = new MongoClient(process.env.MONGODB_URL, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });
  console.log("🔗 Connecting to MongoDB...");
  await mongoClient.connect();
  const dbName = process.env.MONGO_DB || "test";
  mongoDb = mongoClient.db(dbName);
  console.log("✅ MongoDB connected:", dbName);
  return mongoDb;
}

export function getMongo() {
  if (!mongoDb) throw new Error("Mongo DB not connected yet");
  return mongoDb;
}

/* -------------------------------------------------------------------------- */
/*                             CLEAN SHUTDOWN                                 */
/* -------------------------------------------------------------------------- */

export async function closeAll() {
  try {
    await pgPool?.end();
    console.log("🧹 Postgres pool closed.");
  } catch (_) {}
  try {
    await mongoClient?.close();
    console.log("🧹 Mongo client closed.");
  } catch (_) {}
}

process.on("SIGINT", async () => {
  await closeAll();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeAll();
  process.exit(0);
});
