require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", require("./apiRoutes"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

// Cấu trúc clientMap: { clientId: { socketId, language } }
const clientMap = {};

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // Đăng ký client
  socket.on("register", (clientId) => {
    if (!clientId) return;
    clientMap[clientId] = {
      socketId: socket.id,
      language: "vi", // Mặc định là tiếng Việt
    };
    socket.clientId = clientId;
    console.log(`✅ Registered clientId: ${clientId} with socketId: ${socket.id}`);
  });

  // Cập nhật ngôn ngữ client và thông báo cho đối phương
  socket.on("update_language", ({ clientId, language }) => {
    if (clientMap[clientId]) {
      clientMap[clientId].language = language;
      console.log(`🌐 Updated language for ${clientId} to ${language}`);

      const partnerId = clientMap[clientId].partnerId;
      if (partnerId && clientMap[partnerId]) {
        const partnerSocketId = clientMap[partnerId].socketId;
        io.to(partnerSocketId).emit("partner_language_updated", {
          partnerId: clientId,
          language,
        });
        console.log(`🔁 Synced new language to partner ${partnerId}`);
      }
    }
  });


  // Gửi tin nhắn
  socket.on("send_message", ({ from, to, original, translated }) => {
    const target = clientMap[to];
    if (target) {
      io.to(target.socketId).emit("receive_message", {
        from,
        original,
        translated,
        targetLang: target.language,
      });
      console.log(`📤 Message from ${from} to ${to} in ${target.language}`);
    } else {
      console.warn(`⚠️ Client "${to}" not found`);
    }
  });

  // Xử lý kết nối giữa hai thiết bị
  socket.on("connect_to_partner", ({ from, to }) => {
    const fromSocket = clientMap[from]?.socketId;
    const toSocket = clientMap[to]?.socketId;

    if (fromSocket && toSocket) {
      // Lưu partnerId cho 2 phía
      clientMap[from].partnerId = to;
      clientMap[to].partnerId = from;

      io.to(fromSocket).emit("partner_connected", { to });
      io.to(toSocket).emit("partner_connected", { to: from });
    } else {
      io.to(fromSocket).emit("partner_not_found", { to });
    }
  });

  // Ngắt kết nối
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    if (socket.clientId) {
      delete clientMap[socket.clientId];
      console.log(`🗑️ Removed clientId: ${socket.clientId}`);
    }
  });
});

server.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
