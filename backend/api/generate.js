const { GoogleGenAI } = require("@google/genai");

module.exports = async (req, res) => {
  // 1. Set explicit CORS headers for cross-origin frontend calls (e.g. GitHub Pages)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 2. Handle CORS preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Ensure route accepts POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, image, history } = req.body || {};

  if (!prompt && !image) {
    return res.status(400).json({ error: "Prompt or image is required." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing." });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build contents array including conversation history
    const contents = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        if (!msg.text) return;
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      });
    }

    // Build current user message parts
    const currentParts = [];

    // Add inline image if sent in base64 format
    if (image) {
      const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        currentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    // Add prompt text
    if (prompt) {
      currentParts.push({ text: prompt });
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    const currentDate = new Date().toUTCString();
    const systemInstruction = `You are Troop AI, a smart, concise, and helpful assistant created by Aboagye. Provide clear, direct, and factual answers. Current UTC time is ${currentDate}.`;

    // Fallback model cascade
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash"];
    let resultText = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3,
            topP: 0.8
          }
        });

        if (response && response.text) {
          resultText = response.text;
          break; // Exit loop on successful generation
        }
      } catch (err) {
        console.warn(`Model ${modelName} failed or rate limited:`, err.message || err);
        lastError = err;
      }
    }

    if (resultText) {
      return res.status(200).json({ result: resultText });
    }

    // Handle error responses cleanly if all models failed
    const isRateLimit = lastError && (
      lastError.status === 429 || 
      JSON.stringify(lastError).includes("429") || 
      JSON.stringify(lastError).includes("RESOURCE_EXHAUSTED")
    );

    if (isRateLimit) {
      return res.status(429).json({
        error: "Rate limit exceeded across available models. Please wait a minute and try again."
      });
    }

    return res.status(500).json({
      error: "An error occurred while generating a response. Please try again."
    });

  } catch (error) {
    console.error("Gemini Backend Error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};
