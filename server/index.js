const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI
async function saveDebateAnalytics({
    topic,
    side,
    language,
    difficulty,
    userMessage,
    aiResponse,
    provider,
}) {
    try {
        const { error } = await supabase
            .from("debate_analytics")
            .insert({
                topic,
                side,
                language: language || "English",
                difficulty: difficulty || "Beginner",
                user_message: userMessage,
                ai_response: aiResponse,
                provider,
            });

        if (error) {
            console.error(
                "Analytics save failed:",
                error.message
            );
        } else {
            console.log("Debate analytics saved.");
        }
    } catch (error) {
        console.error(
            "Analytics error:",
            error.message
        );
    }
}
({
    apiKey: process.env.GEMINI_API_KEY,
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Backend is healthy",
    });
});
app.post("/api/chat", async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                error: "Message is required.",
            });
        }

        const previousMessages = Array.isArray(history)
            ? history
                .slice(-10)
                .map((item) => {
                    const role =
                        item.role === "assistant"
                            ? "Assistant"
                            : "User";

                    return `${role}: ${item.content}`;
                })
                .join("\n")
            : "";

        const prompt = `
You are Perspectra AI, a helpful general-purpose AI assistant.

Your job is to answer the user's questions accurately, clearly and naturally.

Rules:
1. Understand the user's actual question before answering.
2. Give a direct and useful answer.
3. Explain difficult concepts in simple language when appropriate.
4. Use examples when they improve understanding.
5. Do not unnecessarily repeat the question.
6. Be respectful and conversational.
7. If the user asks for code, provide correct and usable code.
8. If information is uncertain, clearly say so.
9. Do not pretend to have performed actions you cannot perform.
10. Keep the response reasonably concise unless the user asks for detail.

Previous conversation:
${previousMessages}

User's latest message:
${message}

Give the best possible response.
`;

        // =========================================================
        // 1. GEMINI
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
                            maxOutputTokens: 1200,
                            temperature: 0.7,
                        },
                    });

                    break;
                } catch (error) {
                    lastError = error;

                    console.error(
                        `Chat Gemini attempt ${attempt} failed:`,
                        error.status,
                        error.message
                    );

                    if (Number(error.status) === 429) {
                        console.log(
                            "Gemini quota reached. Switching to OpenRouter..."
                        );
                        break;
                    }

                    if (
                        Number(error.status) === 503 &&
                        attempt < 2
                    ) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1500)
                        );

                        continue;
                    }

                    break;
                }
            }

            if (response) {
                const reply = response.text;

                if (reply) {
                    console.log("Chat provider: Gemini");

                    return res.json({
                        reply,
                        provider: "Gemini",
                    });
                }
            }

            console.log(
                "Chat Gemini unavailable:",
                lastError?.message || "Unknown error"
            );
        } else {
            console.log(
                "GEMINI_API_KEY not configured. Trying OpenRouter..."
            );
        }

        // =========================================================
        // 2. OPENROUTER
        // =========================================================

        if (process.env.OPENROUTER_API_KEY) {
            try {
                console.log("Trying OpenRouter chat fallback...");

                const openRouterResponse = await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization:
                                `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
                            max_tokens: 1200,
                            temperature: 0.7,
                        }),
                    }
                );

                const data = await openRouterResponse.json();

                if (!openRouterResponse.ok) {
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

                console.log("Chat provider: OpenRouter");

                return res.json({
                    reply,
                    provider: "OpenRouter",
                });
            } catch (error) {
                console.error(
                    "OpenRouter chat failed:",
                    error.message
                );
            }
        }

        // =========================================================
        // 3. GROQ
        // =========================================================

        if (process.env.GROQ_API_KEY) {
            try {
                console.log("Trying Groq chat fallback...");

                const groqResponse = await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization:
                                `Bearer ${process.env.GROQ_API_KEY}`,
                        },
                        body: JSON.stringify({
                            model: "openai/gpt-oss-20b",
                            messages: [
                                {
                                    role: "user",
                                    content: prompt,
                                },
                            ],
                            max_tokens: 1200,
                            temperature: 0.7,
                        }),
                    }
                );

                const data = await groqResponse.json();

                if (!groqResponse.ok) {
                    throw new Error(
                        data?.error?.message ||
                        "Groq request failed."
                    );
                }

                const reply =
                    data?.choices?.[0]?.message?.content;

                if (!reply) {
                    throw new Error(
                        "Groq returned an empty response."
                    );
                }

                console.log("Chat provider: Groq");

                return res.json({
                    reply,
                    provider: "Groq",
                });
            } catch (error) {
                console.error(
                    "Groq chat failed:",
                    error.message
                );
            }
        }

        return res.status(500).json({
            error:
                "All AI providers are unavailable. Please try again later.",
        });

    } catch (error) {
        console.error("Chat API error:", error);

        return res.status(500).json({
            error:
                "AI response could not be generated. Please try again.",
        });
    }
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

                    await saveDebateAnalytics({
                        topic,
                        side,
                        language,
                        difficulty,
                        userMessage,
                        aiResponse: reply,
                        provider: "Gemini",
                    });

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


        if (process.env.OPENROUTER_API_KEY) {
            try {
                console.log("Trying OpenRouter fallback...");

                const openRouterResponse = await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            "HTTP-Referer": "https://perspectra-ai.vercel.app",
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

                await saveDebateAnalytics({
                    topic,
                    side,
                    language,
                    difficulty,
                    userMessage,
                    aiResponse: reply,
                    provider: "OpenRouter",
                });

                return res.json({
                    reply,
                    provider: "OpenRouter",
                });
            } catch (openRouterError) {

                console.error(
                    "OpenRouter fallback failed:",
                    openRouterError.message
                );

                console.log(
                    "Switching to Groq fallback..."
                );
            }
        } else {

            console.log(
                "OPENROUTER_API_KEY not configured. Switching to Groq..."
            );
        }

        // =========================================================
        // 3. FALLBACK TO GROQ
        // =========================================================

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                error:
                    "All AI providers are unavailable. Please configure Gemini, OpenRouter or Groq.",
            });
        }

        try {
            console.log("Trying Groq fallback...");

            const groqResponse = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-oss-20b",
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

            const data = await groqResponse.json();

            if (!groqResponse.ok) {
                console.error(
                    "Groq error:",
                    groqResponse.status,
                    data
                );

                throw new Error(
                    data?.error?.message ||
                    "Groq request failed."
                );
            }

            const reply =
                data?.choices?.[0]?.message?.content;

            if (!reply) {
                throw new Error(
                    "Groq returned an empty response."
                );
            }

            console.log("Response provider: Groq");

            await saveDebateAnalytics({
                topic,
                side,
                language,
                difficulty,
                userMessage,
                aiResponse: reply,
                provider: "Groq",
            });

            return res.json({
                reply,
                provider: "Groq",
            });
        } catch (groqError) {
            console.error(
                "Groq fallback failed:",
                groqError.message
            );

            return res.status(500).json({
                error:
                    "All AI providers failed. Please try again later.",
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
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const historyText = history
      .map((item) => {
        const role =
          item.role === "assistant" ? "Assistant" : "User";

        return `${role}: ${item.content || item.text || ""}`;
      })
      .join("\n");

    const prompt = `
You are Perspectra AI, a helpful general-purpose AI assistant.

Answer the user's question clearly and naturally.

Conversation history:
${historyText}

User:
${message}

Assistant:
`;

    // =========================
    // 1. GEMINI
    // =========================

    try {
        const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      const reply = result.text;

      if (reply) {
        return res.json({
          reply,
          model: "Gemini",
        });
      }
    } catch (geminiError) {
      console.log("Chat Gemini failed:", geminiError.message);
    }

    // =========================
    // 2. OPENROUTER
    // =========================

    try {
      const openRouterResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [
              {
                role: "system",
                content:
                  "You are Perspectra AI, a helpful general-purpose AI assistant.",
              },
              ...history.map((item) => ({
                role:
                  item.role === "assistant"
                    ? "assistant"
                    : "user",
                content: item.content || item.text || "",
              })),
              {
                role: "user",
                content: message,
              },
            ],
          }),
        }
      );

      const openRouterData =
        await openRouterResponse.json();

      if (
        openRouterResponse.ok &&
        openRouterData?.choices?.[0]?.message?.content
      ) {
        return res.json({
          reply:
            openRouterData.choices[0].message.content,
          model: "OpenRouter",
        });
      }

      console.log(
        "OpenRouter chat failed:",
        openRouterData
      );
    } catch (openRouterError) {
      console.log(
        "OpenRouter chat failed:",
        openRouterError.message
      );
    }

    // =========================
    // 3. GROQ
    // =========================

    try {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
                content:
                  "You are Perspectra AI, a helpful general-purpose AI assistant.",
              },
              ...history.map((item) => ({
                role:
                  item.role === "assistant"
                    ? "assistant"
                    : "user",
                content: item.content || item.text || "",
              })),
              {
                role: "user",
                content: message,
              },
            ],
          }),
        }
      );

      const groqData = await groqResponse.json();

      if (
        groqResponse.ok &&
        groqData?.choices?.[0]?.message?.content
      ) {
        return res.json({
          reply:
            groqData.choices[0].message.content,
          model: "Groq",
        });
      }

      console.log("Groq chat failed:", groqData);
    } catch (groqError) {
      console.log(
        "Groq chat failed:",
        groqError.message
      );
    }

    return res.status(503).json({
      error:
        "All AI providers are currently unavailable.",
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error: "Internal server error.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Perspectra AI server running on port ${PORT}`
    );
});