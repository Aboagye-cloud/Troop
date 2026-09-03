const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  const { prompt, history } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on Vercel." });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Build contents array including conversation history if sent from frontend
    const contents = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      });
    }
    // Append current prompt
    contents.push({
      role: "user",
      parts: [{ text: prompt }]
    });

    const currentDate = new Date().toUTCString();

    // 2. Call Gemini using systemInstruction and generationConfig
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Recommended standard fast model
      contents: contents,
      config: {
        // Enforces persona and constraints
        systemInstruction: `You are Troop AI, a smart, concise, and helpful assistant created by Aboagye. Provide clear, direct, and factual answers. Current UTC time is ${currentDate}.`,
        // Lower temperature prevents silly/unfocused hallucinated responses
        temperature: 0.3,
        topP: 0.8
      }
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || String(error) });
  }
});

module.exports = app;
