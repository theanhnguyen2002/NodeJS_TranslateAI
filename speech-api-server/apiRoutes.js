const express = require("express");
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { SpeechClient } = require("@google-cloud/speech");
const multer = require("multer");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

const GOOGLE_API_KEY = "AIzaSyCZjHJDsuQrBM0C4huWRx5Cdi6XVTRpwrs";
const client = new SpeechClient({ keyFilename: "./profound-ranger-465218-v8-5a100c67c0ad.json" });

// 📌 Dịch văn bản
router.post("/translate", async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  if (!text || !sourceLang || !targetLang)
    return res.status(400).json({ error: "Thiếu tham số" });

  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;

  const body = {
    q: text,
    source: sourceLang,
    target: targetLang,
    format: "text",
    model: "nmt",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Lỗi dịch:", err);
    res.status(500).json({ error: "Không thể dịch" });
  }
});

// 📌 Nhận diện văn bản từ ảnh
router.post("/detect-text", async (req, res) => {
  const { base64Image } = req.body;

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`;
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    const text =
      result?.responses?.[0]?.fullTextAnnotation?.text ||
      "Không nhận diện được chữ.";
    res.json({ text });
  } catch (err) {
    console.error("Lỗi OCR:", err);
    res.status(500).json({ error: "Không thể nhận diện văn bản" });
  }
});

// 📌 Chuyển giọng nói thành văn bản
router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    const audioBytes = fs.readFileSync(req.file.path).toString("base64");

    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "vi-VN",
      },
    };

    const [response] = await client.recognize(request);
    const transcript = response.results
      .map((r) => r.alternatives[0].transcript)
      .join(" ");

    res.json({ transcript });
  } catch (err) {
    console.error("Lỗi chuyển giọng nói:", err);
    res.status(500).json({ error: "Không thể xử lý âm thanh" });
  }
});

module.exports = router;
