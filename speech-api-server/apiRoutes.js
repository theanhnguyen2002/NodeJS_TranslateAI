const express = require("express");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { SpeechClient } = require("@google-cloud/speech");
const textToSpeech = require("@google-cloud/text-to-speech");

const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const ttsClient = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const upload = multer({ dest: "uploads/" });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// 🔤 Dịch văn bản
router.post("/translate", async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;
  if (!text || !sourceLang || !targetLang)
    return res.status(400).json({ error: "Thiếu tham số" });

  try {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: "text",
        model: "nmt",
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Lỗi dịch văn bản:", err);
    res.status(500).json({ error: "Không thể dịch văn bản" });
  }
});

// 🖼️ OCR từ ảnh base64
router.post("/detect-text", async (req, res) => {
  const { base64Image } = req.body;
  if (!base64Image) return res.status(400).json({ error: "Thiếu ảnh base64" });

  try {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    });
    const result = await response.json();
    const text = result?.responses?.[0]?.fullTextAnnotation?.text || "Không nhận diện được chữ.";
    res.json({ text });
  } catch (err) {
    console.error("❌ Lỗi OCR:", err);
    res.status(500).json({ error: "Không thể nhận diện văn bản" });
  }
});

// 🎤 Speech-to-Text
router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    const audioBytes = fs.readFileSync(req.file.path).toString("base64");

    const [response] = await speechClient.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "vi-VN",
      },
    });

    const transcript = response.results
      .map(result => result.alternatives[0].transcript)
      .join(" ");

    res.json({ transcript });
  } catch (err) {
    console.error("❌ Lỗi chuyển giọng nói:", err);
    res.status(500).json({ error: "Không thể xử lý âm thanh" });
  } finally {
    if (req.file?.path) fs.unlinkSync(req.file.path);
  }
});

// 🔊 Text-to-Speech (ĐÃ SỬA CHUẨN)
router.post("/text-to-speech", async (req, res) => {
  const { text, lang } = req.body;
  if (!text || !lang) return res.status(400).json({ error: "Thiếu tham số" });

  try {
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: lang, ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "MP3" }, // ✅ Dùng đúng MP3
    });

    const audioBuffer = response.audioContent;
    const audioBase64 = audioBuffer.toString("base64");

    // ✅ Trả đúng MIME type: audio/mpeg (mp3)
    res.json({
      audio: `data:audio/mpeg;base64,${audioBase64}`,
    });
  } catch (err) {
    console.error("❌ Lỗi Text-to-Speech:", err);
    res.status(500).json({ error: "Không thể chuyển văn bản thành giọng nói" });
  }
});

// 🔐 Tạo clientId
router.get("/get-client-id", (req, res) => {
  res.json({ clientId: Math.floor(100000 + Math.random() * 900000) });
});

module.exports = router;
