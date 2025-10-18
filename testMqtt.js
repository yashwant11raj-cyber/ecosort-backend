import mqtt from "mqtt";

const client = mqtt.connect("wss://7992e85b257745a89a6c2161c9e82cad.s1.eu.hivemq.cloud:8884/mqtt", {
  username: "yashwant11raj",
  password: "Abab1212",
});

client.on("connect", () => {
  console.log("✅ Connected!");
  client.end();
});

client.on("error", (err) => {
  console.error("❌ Connection failed:", err.message);
});
