// backend/src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

/**
 * Verifies JWT tokens on protected routes.
 * Requires JWT_SECRET in environment variables.
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach decoded payload
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
