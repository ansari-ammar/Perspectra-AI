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

    // =========================================================
    // 1. TRY GEMINI FIRST
    // =========================================================

    if (process.env.GEMINI_API_KEY) {
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

          // Quota error:
          // Don't retry Gemini. Go directly to OpenRouter.
          if (Number(error.status) === 429) {
            console.log("Gemini quota reached. Switching to OpenRouter...");
            break;
          }

          // Temporary server error:
          // Retry Gemini once.
          if (
            Number(error.status) === 503 &&
            attempt < 2
          ) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1500)
            );

            continue;
          }

          // Any other Gemini error:
          // Move to OpenRouter.
          break;
        }
      }

      if (response) {
        const reply = response.text;

        if (reply) {
          console.log("Response provider: Gemini");

          return res.json({
            reply,
            provider: "Gemini",
          });
        }
      }

      console.log(
        "Gemini unavailable:",
        lastError?.message || "Unknown error"
      );
    } else {
      console.log(
        "GEMINI_API_KEY not configured. Trying OpenRouter..."
      );
    }

    // =========================================================
    // 2. FALLBACK TO OPENROUTER
    // =========================================================

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error:
          "Both Gemini and OpenRouter are unavailable. Please configure the AI providers.",
      });
    }

    try {
      console.log("Trying OpenRouter fallback...");

      const openRouterResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer":
              "https://perspectra-ai.vercel.app",
            "X-Title": "Perspectra AI",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 700,
            temperature: 0.7,
          }),
        }
      );

      const data = await openRouterResponse.json();

      if (!openRouterResponse.ok) {
        console.error(
          "OpenRouter error:",
          openRouterResponse.status,
          data
        );

        throw new Error(
          data?.error?.message ||
            "OpenRouter request failed."
        );
      }

      const reply =
        data?.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error(
          "OpenRouter returned an empty response."
        );
      }

      console.log("Response provider: OpenRouter");

      return res.json({
        reply,
        provider: "OpenRouter",
      });
    } catch (openRouterError) {
      console.error(
        "OpenRouter fallback failed:",
        openRouterError.message
      );

      return res.status(500).json({
        error:
          "AI response could not be generated. Please try again.",
      });
    }
  } catch (error) {
    console.error("Debate API error:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      error:
        "AI response could not be generated. Please try again.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Perspectra AI server running on port ${PORT}`
  );
});