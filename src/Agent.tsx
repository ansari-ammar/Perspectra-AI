import { useEffect, useState } from "react";

type Message = {
    role: "user" | "assistant";
    text: string;
};

type Chat = {
    id: string;
    title: string;
    messages: Message[];
};

type AgentProps = {
    onBack: () => void;
};

const STORAGE_KEY = "perspectra-agent-chats";

function createChat(): Chat {
    return {
        id:
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
        title: "New Chat",
        messages: [],
    };
}

export default function Agent({ onBack }: AgentProps) {
    const [chats, setChats] = useState<Chat[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved) {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (error) {
            console.error("Failed to load chats:", error);
        }

        return [createChat()];
    });

    const [activeChatId, setActiveChatId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved) {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed[0].id;
                }
            }
        } catch {
            // ignore
        }

        return "";
    });

    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const activeChat =
        chats.find((chat) => chat.id === activeChatId) || chats[0];

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }, [chats]);

    useEffect(() => {
        if (!activeChatId && chats.length > 0) {
            setActiveChatId(chats[0].id);
        }
    }, [activeChatId, chats]);

    function updateActiveChat(
        updater: (chat: Chat) => Chat
    ) {
        setChats((previous) =>
            previous.map((chat) =>
                chat.id === activeChat?.id ? updater(chat) : chat
            )
        );
    }

    function startNewChat() {
        const newChat = createChat();

        setChats((previous) => [newChat, ...previous]);
        setActiveChatId(newChat.id);
        setDraft("");
        setCopiedIndex(null);
    }

    function selectChat(id: string) {
        setActiveChatId(id);
        setDraft("");
        setCopiedIndex(null);
    }

    function deleteChat(id: string) {
        if (chats.length === 1) {
            const newChat = createChat();

            setChats([newChat]);
            setActiveChatId(newChat.id);
            return;
        }

        const remaining = chats.filter((chat) => chat.id !== id);

        setChats(remaining);

        if (id === activeChatId) {
            setActiveChatId(remaining[0].id);
        }
    }

    async function sendMessage(customMessage?: string) {
        const userMessage = (customMessage ?? draft).trim();

        if (!userMessage || loading || !activeChat) {
            return;
        }

        const previousHistory = activeChat.messages;

        const userMsg: Message = {
            role: "user",
            text: userMessage,
        };

        updateActiveChat((chat) => ({
            ...chat,
            title:
                chat.messages.length === 0
                    ? userMessage.length > 35
                        ? `${userMessage.slice(0, 35)}...`
                        : userMessage
                    : chat.title,
            messages: [...chat.messages, userMsg],
        }));

        setDraft("");
        setLoading(true);

        try {
            const response = await fetch(
                "https://perspectra-ai-api.onrender.com/api/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: userMessage,
                        history: previousHistory.map((message) => ({
                            role: message.role,
                            content: message.text,
                        })),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || "AI request failed");
            }

            const assistantMessage: Message = {
                role: "assistant",
                text:
                    data.reply ||
                    "Sorry, I couldn't generate a response.",
            };

            updateActiveChat((chat) => ({
                ...chat,
                messages: [...chat.messages, assistantMessage],
            }));
        } catch (error) {
            console.error("Agent error:", error);

            updateActiveChat((chat) => ({
                ...chat,
                messages: [
                    ...chat.messages,
                    {
                        role: "assistant",
                        text:
                            "Sorry, something went wrong while connecting to Perspectra AI.",
                    },
                ],
            }));
        } finally {
            setLoading(false);
        }
    }

    async function copyMessage(text: string, index: number) {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);

            setTimeout(() => {
                setCopiedIndex(null);
            }, 1500);
        } catch (error) {
            console.error("Copy failed:", error);
        }
    }

    function regenerateMessage(index: number) {
        if (!activeChat || loading) return;

        const assistantMessage = activeChat.messages[index];

        if (!assistantMessage || assistantMessage.role !== "assistant") {
            return;
        }

        let userMessage = "";

        for (let i = index - 1; i >= 0; i--) {
            if (activeChat.messages[i].role === "user") {
                userMessage = activeChat.messages[i].text;
                break;
            }
        }

        if (!userMessage) return;

        const historyBeforeUser = activeChat.messages.slice(0, index - 1);

        updateActiveChat((chat) => ({
            ...chat,
            messages: chat.messages.slice(0, index),
        }));

        setTimeout(async () => {
            setLoading(true);

            try {
                const response = await fetch(
                    "https://perspectra-ai-api.onrender.com/api/chat",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: userMessage,
                            history: historyBeforeUser.map((message) => ({
                                role: message.role,
                                content: message.text,
                            })),
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || "Regeneration failed");
                }

                updateActiveChat((chat) => ({
                    ...chat,
                    messages: [
                        ...chat.messages,
                        {
                            role: "assistant",
                            text: data.reply,
                        },
                    ],
                }));
            } catch (error) {
                console.error(error);

                updateActiveChat((chat) => ({
                    ...chat,
                    messages: [
                        ...chat.messages,
                        {
                            role: "assistant",
                            text: "Unable to regenerate the response.",
                        },
                    ],
                }));
            } finally {
                setLoading(false);
            }
        }, 0);
    }

    function editMessage(index: number) {
        if (!activeChat) return;

        const message = activeChat.messages[index];

        if (message.role !== "user") return;

        setDraft(message.text);

        updateActiveChat((chat) => ({
            ...chat,
            messages: chat.messages.slice(0, index),
        }));
    }

    function useSuggestion(text: string) {
        setDraft(text);
    }

    function handleKeyDown(
        event: React.KeyboardEvent<HTMLTextAreaElement>
    ) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    return (
        <div className="agent-page">

            {/* ================= SIDEBAR ================= */}

            <aside className="agent-sidebar">

                {/* SIDEBAR BRAND */}
                <div className="agent-sidebar-brand">
                    <div className="agent-sidebar-brand-icon">
                        P
                    </div>

                    <div className="agent-sidebar-brand-text">
                        <strong>
                            Perspectra <span>AI</span>
                        </strong>

                        <small>AI Workspace</small>
                    </div>
                </div>

                <button
                    type="button"
                    className="sidebar-new-chat-button"
                    onClick={startNewChat}
                >
                    <span className="sidebar-new-chat-icon">✦</span>

                    <span className="sidebar-new-chat-text">
                        New Chat
                    </span>

                    <span className="sidebar-new-chat-arrow">
                        ↗
                    </span>
                </button>

                <div className="agent-sidebar-history">

                    <div className="agent-sidebar-title">
                        Chat History
                    </div>

                    {chats.map((chat) => (
                        <div
                            key={chat.id}
                            className={`agent-chat-item ${chat.id === activeChat?.id ? "active" : ""
                                }`}
                            onClick={() => selectChat(chat.id)}
                        >
                            <button
                                type="button"
                                className="agent-chat-select"
                                onClick={() => selectChat(chat.id)}
                            >
                                <span className="agent-chat-icon">
                                    💬
                                </span>

                                <span className="agent-chat-title">
                                    {chat.title}
                                </span>
                            </button>

                            <button
                                type="button"
                                className="agent-chat-delete"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    deleteChat(chat.id);
                                }}
                                aria-label="Delete chat"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                </div>

                <button
                    className="agent-sidebar-back"
                    onClick={onBack}
                    type="button"
                >
                    ← Back to Perspectra
                </button>

            </aside>


            {/* ================= MAIN WORKSPACE ================= */}

            <section className="agent-workspace">

                {/* HEADER */}

                <header className="agent-header">

                    <div className="agent-title">

                        <div className="agent-title-icon">
                            P
                        </div>

                        <div>
                            <strong>Perspectra AI Agent</strong>
                            <small>Your all-in-one AI assistant</small>
                        </div>

                    </div>

                    <button
                        className="agent-header-new-chat"
                        type="button"
                        onClick={startNewChat}
                    >
                        <span className="agent-header-new-chat-icon">
                            +
                        </span>
                    </button>

                </header>


                {/* CHAT CONTENT */}

                <main className="agent-main">

                    <div className="agent-messages">

                        {activeChat?.messages.length === 0 ? (

                            <div className="agent-welcome">

                                <div className="agent-welcome-icon">
                                    ✦
                                </div>

                                <h1>
                                    How can I help you?
                                </h1>

                                <p>
                                    Ask anything, analyze files, search the web,
                                    write code, research topics, and more.
                                </p>


                                <div className="agent-suggestions">

                                    <button
                                        type="button"
                                        className="agent-suggestion"
                                        onClick={() =>
                                            useSuggestion(
                                                "Explain artificial intelligence in simple words."
                                            )
                                        }
                                    >
                                        🤖 Explain AI in simple words
                                    </button>

                                    <button
                                        type="button"
                                        className="agent-suggestion"
                                        onClick={() =>
                                            useSuggestion(
                                                "Help me study this topic step by step."
                                            )
                                        }
                                    >
                                        📚 Help me study a topic
                                    </button>

                                    <button
                                        type="button"
                                        className="agent-suggestion"
                                        onClick={() =>
                                            useSuggestion(
                                                "Write a clean and optimized JavaScript program for me."
                                            )
                                        }
                                    >
                                        💻 Help me write code
                                    </button>

                                    <button
                                        type="button"
                                        className="agent-suggestion"
                                        onClick={() =>
                                            useSuggestion(
                                                "Give me a detailed explanation of this topic."
                                            )
                                        }
                                    >
                                        🔎 Research a topic
                                    </button>

                                </div>

                            </div>

                        ) : (

                            <div className="agent-message-list">

                                {activeChat?.messages.map(
                                    (message, index) => (

                                        <div
                                            key={`${index}-${message.role}`}
                                            className={`agent-message ${message.role
                                                }`}
                                        >

                                            <div className="agent-message-inner">

                                                {message.role === "assistant" && (
                                                    <div className="agent-avatar">
                                                        P
                                                    </div>
                                                )}

                                                <div className="agent-message-column">

                                                    <div className="agent-message-content">
                                                        {message.text}
                                                    </div>

                                                    <div className="agent-message-actions">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copyMessage(
                                                                    message.text,
                                                                    index
                                                                )
                                                            }
                                                        >
                                                            {copiedIndex === index
                                                                ? "✓ Copied"
                                                                : "Copy"}
                                                        </button>

                                                        {message.role === "user" && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    editMessage(index)
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                        )}

                                                        {message.role ===
                                                            "assistant" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        regenerateMessage(
                                                                            index
                                                                        )
                                                                    }
                                                                >
                                                                    Regenerate
                                                                </button>
                                                            )}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    )
                                )}

                                {loading && (
                                    <div className="agent-message assistant">

                                        <div className="agent-message-inner">

                                            <div className="agent-avatar">
                                                P
                                            </div>

                                            <div className="agent-typing">
                                                <span />
                                                <span />
                                                <span />
                                            </div>

                                        </div>

                                    </div>
                                )}

                            </div>

                        )}

                    </div>


                    {/* ================= INPUT ================= */}

                    <div className="agent-input-container">

                        <div className="agent-input-wrapper">

                            <div className="agent-tools">

                                <button
                                    type="button"
                                    className="agent-tool"
                                >
                                    📎 Attach
                                </button>

                                <button
                                    type="button"
                                    className="agent-tool"
                                >
                                    🌐 Search
                                </button>

                                <button
                                    type="button"
                                    className="agent-tool"
                                >
                                    🧠 Think
                                </button>

                                <button
                                    type="button"
                                    className="agent-tool"
                                >
                                    🎨 Create
                                </button>

                                <button
                                    type="button"
                                    className="agent-tool"
                                >
                                    🎙 Voice
                                </button>

                            </div>


                            <div className="agent-input-box">

                                <textarea
                                    value={draft}
                                    onChange={(event) =>
                                        setDraft(event.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask Perspectra anything..."
                                    rows={1}
                                    disabled={loading}
                                />

                                <button
                                    type="button"
                                    className="agent-send-button"
                                    onClick={() => sendMessage()}
                                    disabled={
                                        loading || !draft.trim()
                                    }
                                    aria-label="Send message"
                                >
                                    ↑
                                </button>

                            </div>

                            <div className="agent-disclaimer">
                                Perspectra AI can make mistakes. Check important information.
                            </div>

                        </div>

                    </div>

                </main>

            </section>

        </div>
    );
}