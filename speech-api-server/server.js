const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const { SpeechClient } = require("@google-cloud/speech");

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: "uploads/" });

app.use(cors());

// const client = new SpeechClient({
//   keyFilename: "./profound-ranger-465218-v8-5a100c67c0ad.json", // key bạn tải về
// });

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const client = new SpeechClient({ credentials });

app.post("/api/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    const audioBytes = fs.readFileSync(req.file.path).toString("base64");

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "vi-VN", // "en-US" nếu cần
      },
    };

    const [response] = await client.recognize(request);
    const transcript = response.results
      .map((r) => r.alternatives[0].transcript)
      .join(" ");

    res.json({ transcript });
  } catch (err) {
    console.error("❌ Lỗi xử lý:", err);
    res.status(500).json({ error: "Lỗi chuyển giọng nói" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.send("API server đang chạy!");
});
