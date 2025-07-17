require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", require("./apiRoutes"));

// Tạo server HTTP và socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

// Dữ liệu lưu client
// Cấu trúc: { clientId: { socketId, language, partnerId } }
const clientMap = {};

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  /**
   * 📍 1. Đăng ký client lần đầu
   */
  socket.on("register", (clientId) => {
    if (!clientId) return;
    clientMap[clientId] = {
      socketId: socket.id,
      language: "vi", // mặc định là tiếng Việt
      partnerId: null,
    };
    socket.clientId = clientId;
    console.log(`✅ Registered clientId: ${clientId} with socketId: ${socket.id}`);
  });

  /**
   * 🌐 2. Cập nhật ngôn ngữ
   */
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

  /**
   * 💬 3. Gửi tin nhắn đã dịch
   */
  socket.on("send_message", ({ from, to, original, translated }) => {
    const target = clientMap[to];
    if (target) {
      const targetLang = target.language || "en";
      io.to(target.socketId).emit("receive_message", {
        from,
        original,
        translated,
        targetLang,
      });
      console.log(`📤 Message from ${from} to ${to} in ${targetLang}`);
    } else {
      console.warn(`⚠️ Client "${to}" not found`);
    }
  });

  /**
   * 🔗 4. Kết nối hai thiết bị với nhau
   */
  socket.on("connect_to_partner", ({ from, to }) => {
    const fromSocket = clientMap[from]?.socketId;
    const toSocket = clientMap[to]?.socketId;

    if (fromSocket && toSocket) {
      clientMap[from].partnerId = to;
      clientMap[to].partnerId = from;

      // Thông báo kết nối thành công
      io.to(fromSocket).emit("partner_connected", { to });
      io.to(toSocket).emit("partner_connected", { to: from });

      // Gửi ngôn ngữ partner sang nhau
      io.to(fromSocket).emit("partner_language_updated", {
        partnerId: to,
        language: clientMap[to].language,
      });
      io.to(toSocket).emit("partner_language_updated", {
        partnerId: from,
        language: clientMap[from].language,
      });

      console.log(`🔗 Connected ${from} <--> ${to}`);
    } else {
      if (fromSocket) {
        io.to(fromSocket).emit("partner_not_found", { to });
      }
      console.warn(`❌ Cannot connect ${from} to ${to} - partner not found`);
    }
  });

  /**
   * ❌ 5. Ngắt kết nối
   */
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    const clientId = socket.clientId;

    if (clientId && clientMap[clientId]) {
      const partnerId = clientMap[clientId].partnerId;
      delete clientMap[clientId];

      // Thông báo cho partner nếu còn
      if (partnerId && clientMap[partnerId]) {
        const partnerSocketId = clientMap[partnerId].socketId;
        clientMap[partnerId].partnerId = null;

        io.to(partnerSocketId).emit("partner_disconnected", {
          from: clientId,
        });
        console.log(`⚠️ Notified partner ${partnerId} of disconnection`);
      }

      console.log(`🗑️ Removed clientId: ${clientId}`);
    }
  });
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
