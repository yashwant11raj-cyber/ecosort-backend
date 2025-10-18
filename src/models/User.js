const { getPostgres } = require("../db");
const bcrypt = require("bcryptjs");

async function findUserByEmail(email) {
  const result = await getPostgres().query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
}

async function createUser(email, password, role = "viewer") {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await getPostgres().query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *",
    [email, passwordHash, role]
  );
  return result.rows[0];
}

module.exports = { findUserByEmail, createUser };