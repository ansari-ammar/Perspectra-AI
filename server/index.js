
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is healthy",
  });
});

app.post("/api/debate", async (req, res) => {
  try {
    const {
      topic,
      side,
      language,
      difficulty,
      history,
      userMessage,
    } = req.body;

    if (
      !topic ||
      !side ||
      !userMessage ||
      typeof userMessage !== "string"
    ) {
      return res.status(400).json({
        error: "Topic, side and argument are required.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini API key is not configured.",
      });
    }

    const aiSide = side === "for" ? "Against" : "For";

    const previousMessages = Array.isArray(history)
      ? history
          .slice(-8)
          .map((message) => {
            const speaker =
              message.speaker === "You"
                ? "User"
                : "AI Opponent";

            return `${speaker}: ${message.text}`;
          })
          .join("\n")
      : "";

    const prompt = `
You are Perspectra AI, a respectful debate opponent.

Debate topic: ${topic}
User's side: ${side === "for" ? "For" : "Against"}
Your side: ${aiSide}
Language: ${language || "English"}
Difficulty: ${difficulty || "Beginner"}

Rules:
1. Argue from your assigned side.
2. Respond directly to the user's actual argument.
3. Give clear reasoning and relevant examples.
4. Do not simply repeat the same argument.
5. Keep the response concise and suitable for a student.
6. Be respectful and do not insult the user.
7. Use the selected language naturally.
8. Do not claim that you have evaluated the user's full performance.
9. Keep your response around 120–180 words.
10. Give a complete argument with a short conclusion.
11. Avoid unnecessary introductions.

Previous debate:
${previousMessages}

User's latest argument:
${userMessage}

Give your debate response.
`;

    let response;
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            maxOutputTokens: 700,
            temperature: 0.7,
          },
        });

        break;
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini attempt ${attempt} failed:`,
          error.status,
          error.message
        );

        // Do not retry when the quota is exhausted.
        if (Number(error.status) === 429) {
          return res.status(429).json({
            error:
              "Gemini API quota limit reached. Please try again after your quota resets.",
          });
        }

        // Retry only temporary service errors.
        if (
          Number(error.status) !== 503 ||
          attempt === 2
        ) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1500)
        );
      }
    }

    if (!response) {
      throw lastError || new Error("Gemini returned no response.");
    }

    const reply = response.text;

    if (!reply) {
      throw new Error("The AI returned an empty response.");
    }

    return res.json({ reply });
  } catch (error) {
    console.error("Debate API error:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      error: "AI response could not be generated. Please try again.",
    });
  }
});

app.listen(5000, "0.0.0.0", () => {
  console.log("Server running on port 5000");
});