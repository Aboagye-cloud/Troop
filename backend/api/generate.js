const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // 1. CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on Vercel." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const currentDate = new Date().toUTCString();
    const systemInstruction = `You are Troop AI, a smart, concise, and helpful assistant created by Aboagye. Provide clear, direct, and factual answers. Current UTC time is ${currentDate}.`;

    // 2. Format history into SDK-compliant format
    const formattedHistory = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        if (!msg.text) return;
        formattedHistory.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      });
    }

    // 3. Construct user input parts
    const currentParts = [];
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

    if (prompt) {
      currentParts.push({ text: prompt });
    }

    // 4. Use supported active model endpoints
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let resultText = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
          generationConfig: {
            temperature: 0.3,
            topP: 0.8
          }
        });

        let response;
        if (formattedHistory.length > 0) {
          const chat = model.startChat({ history: formattedHistory });
          const result = await chat.sendMessage(currentParts);
          response = await result.response;
        } else {
          const result = await model.generateContent(currentParts);
          response = await result.response;
        }

        if (response) {
          resultText = response.text();
          break;
        }
      } catch (err) {
        console.error(`Model ${modelName} error:`, err);
        lastError = err;
      }
    }

    if (resultText) {
      return res.status(200).json({ result: resultText });
    }

    // 5. Diagnostics error output
    return res.status(500).json({
      error: lastError?.message || "An error occurred while generating a response."
    });

  } catch (error) {
    console.error("Gemini Backend Error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
};
