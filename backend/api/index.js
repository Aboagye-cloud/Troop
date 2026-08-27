const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on Vercel." });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Pass the real-time UTC timestamp so the model knows the accurate date
    const currentDate = new Date().toUTCString();
    const contextualPrompt = `[System Context: Current UTC time is ${currentDate}]\n\nUser Prompt: ${prompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: contextualPrompt,
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

module.exports = app;
