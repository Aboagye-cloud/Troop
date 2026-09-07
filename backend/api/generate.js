const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
  // 1. Set explicit CORS headers for cross-origin frontend calls
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
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing on Vercel." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const currentDate = new Date().toUTCString();
    
    // Expanded system instruction containing rich context about Peter Aboagye
    const systemInstruction = `You are Troop AI, a smart, concise, and helpful assistant created by Peter Aboagye. 

About your creator:
- Peter Aboagye is a software developer, technical creator, and ICT educator.
- He built Troop AI as a custom AI assistant application integrated with Vercel and GitHub Pages.
- Academic Background: Pursuing a B.Sc. in ICT Education, backed by a Diploma in Basic Education.

Provide clear, direct, and factual answers. Current UTC time is ${currentDate}.`;

    // 4. Format history into SDK-compliant structure
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

    // 5. Construct current user input parts
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

    // 6. Active production models
    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-flash-latest"];
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

    // 7. Surface underlying error for debugging
    return res.status(500).json({
      error: lastError?.message || "An error occurred while generating a response."
    });

  } catch (error) {
    console.error("Gemini Backend Error:", error);
    return res.status(500).json({ error: error?.message || "Internal server error." });
  }
};
