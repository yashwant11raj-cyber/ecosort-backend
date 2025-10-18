require("dotenv").config();
const { Client } = require("pg");

console.log("DEBUG Connection URL:", process.env.POSTGRES_URL);

const client = new Client({
  connectionString: process.env.POSTGRES_URL
});

async function test() {
  try {
    await client.connect();
    const res = await client.query("SELECT NOW()");
    console.log("✅ Connected! Time:", res.rows[0]);
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
  }
}

test();