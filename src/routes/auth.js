// backend/src/routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { supabase } from "../app.js";   // reuses the Supabase client from app.js

dotenv.config();
const router = express.Router();

/**
 * POST /api/auth/login
 * Handles user login via Supabase Auth or local fallback account.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // --- 1️⃣  Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // --- 2️⃣  Local fallback login for testing without Supabase
  if (email === "admin@example.com" && password === "123456") {
    const token = jwt.sign(
      { email, role: "operator" },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1h" }
    );
    console.log("✅ Local admin login successful");
    return res.json({ token });
  }

  // --- 3️⃣  Attempt Supabase authentication
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.warn("⚠️  Supabase login failed:", error?.message);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = data.user;
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1h" }
    );

    console.log("✅ Supabase login successful:", user.email);
    res.json({ token });
  } catch (err) {
    console.error("❌ Server error during login:", err.message);
    res.status(500).json({ message: "Server error during login" });
  }
});

/**
 * GET /api/auth/verify
 * Verifies that a JWT token is valid.
 */
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
    res.json({ valid: true, decoded });
  } catch (err) {
    res.status(401).json({ valid: false, message: "Invalid or expired token" });
  }
});

/**
 * Optional health check route
 */
router.get("/test", (req, res) => {
  res.json({ message: "Auth route OK" });
});

export default router;
