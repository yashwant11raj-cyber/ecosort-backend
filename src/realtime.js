// backend/src/realtime.js
let io = null;

function initSocket(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "https://ecosort-dashboard.vercel.app"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  io.on("connection", socket => {
    // useful for debugging
    // console.log("🔌 client connected", socket.id);
  });
  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}

module.exports = { initSocket, getIO };
