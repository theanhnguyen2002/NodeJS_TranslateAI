require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", require("./apiRoutes"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const clientMap = {};

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("register", (clientId) => {
    if (!clientId) return;
    clientMap[clientId] = socket.id;
    socket.clientId = clientId;
    console.log(`✅ Registered: clientId = ${clientId}, socketId = ${socket.id}`);
  });

  socket.on("send_message", ({ from, to, original, translated }) => {
    const target = clientMap[to];
    if (target) {
      io.to(target).emit("receive_message", { from, original, translated });
      console.log(`📤 Tin nhắn từ ${from} đến ${to}`);
    } else {
      console.warn(`⚠️ Không tìm thấy clientId "${to}"`);
    }
  });

  socket.on("connect_to_partner", ({ from, to }) => {
    const fromSocket = clientMap[from];
    const toSocket = clientMap[to];
    io.to(fromSocket).emit(toSocket ? "partner_connected" : "partner_not_found", { to });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    if (socket.clientId) {
      delete clientMap[socket.clientId];
      console.log(`🗑️ Đã xoá clientId: ${socket.clientId}`);
    }
  });
});

server.listen(port, () => console.log(`🚀 Server đang chạy tại http://localhost:${port}`));
