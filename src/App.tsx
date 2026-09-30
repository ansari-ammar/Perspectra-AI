import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./App.css";

const topics = ["AI & Technology", "Education", "Society", "Environment"];

function App() {
    const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setAuthMessage(error.message);
      }

      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authBusy) return;

    setAuthBusy(true);
    setAuthMessage("");

    try {
      const email = authEmail.trim();

      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
        });

        if (error) throw error;

        if (data.session) {
          setAuthMessage("Account created successfully!");
        } else {
          setAuthMessage(
            "Signup submitted. Check your email for a confirmation link, then log in."
          );
          setAuthMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        });

        if (error) throw error;
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Authentication failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthMessage(error.message);
    }
  }
  const [topic, setTopic] = useState("");
  const [side, setSide] = useState<"for" | "against" | "">("");
  const [showSetup, setShowSetup] = useState(false);
  const [showDebate, setShowDebate] = useState(false);
const [draft, setDraft] = useState("");
const [round, setRound] = useState(1);
const [messages, setMessages] = useState<
  { speaker: string; text: string }[]
>([]);
  const [language, setLanguage] = useState("English");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [rounds, setRounds] = useState("3");
  const [loading, setLoading] = useState(false);

  function continueToSetup() {
    if (!topic.trim()) {
      alert("Please enter or choose a debate topic.");
      return;
    }

    if (!side) {
      alert("Please choose For or Against.");
      return;
    }

    setShowSetup(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


function startDebate() {
  const aiSide = side === "for" ? "Against" : "For";

  setMessages([
    {
      speaker: "AI Opponent",
      text: `I will argue ${aiSide} the topic: "${topic}". Let's begin! ${
        aiSide === "For"
          ? "There are several reasons why this statement deserves support. What is your opening argument?"
          : "There are important concerns and counterarguments to consider. What is your opening argument?"
      }`,
    },
  ]);

  setRound(1);
  setDraft("");
  setShowSetup(false);
  setShowDebate(true);

  window.scrollTo({ top: 0, behavior: "smooth" });
}



async function sendMessage() {
  if (!draft.trim() || loading) {
    return;
  }

  const userMessage = draft.trim();

  setMessages((previous) => [
    ...previous,
    { speaker: "You", text: userMessage },
  ]);

  setDraft("");
  setLoading(true);

  try {
    const response = await fetch(
      "https://perspectra-ai-api.onrender.com/api/debate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          side,
          language,
          difficulty,
          rounds,
          history: messages,
          userMessage,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "AI request failed."
      );
    }

    setMessages((previous) => [
      ...previous,
      {
        speaker: "AI Opponent",
        text: data.reply,
      },
    ]);

    setRound((previous) =>
      Math.min(previous + 1, Number(rounds))
    );
  } catch (error) {
    setMessages((previous) => [
      ...previous,
      {
        speaker: "System",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong.",
      },
    ]);
  } finally {
    setLoading(false);
  }
}

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand auth-brand">
            <span className="brand-icon">P</span>
            <span>
              Perspectra <strong>AI</strong>
            </span>
          </div>
          <p className="auth-message">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <a className="brand auth-brand" href="/">
            <span className="brand-icon">P</span>
            <span>
              Perspectra <strong>AI</strong>
            </span>
          </a>

          <p className="section-label">YOUR DEBATE JOURNEY STARTS HERE</p>

          <h1 className="auth-title">
            {authMode === "login" ? "Welcome back." : "Create your account."}
          </h1>

          <p className="auth-description">
            {authMode === "login"
              ? "Log in to continue exploring different perspectives."
              : "Sign up to start practicing stronger arguments."}
          </p>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={
                authMode === "login" ? "current-password" : "new-password"
              }
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Enter your password"
              minLength={6}
              required
            />

            <button
              className="start-button"
              type="submit"
              disabled={authBusy}
            >
              {authBusy
                ? "Please wait..."
                : authMode === "login"
                  ? "Log in →"
                  : "Create account →"}
            </button>
          </form>

          {authMessage && (
            <p className="auth-message" role="status">
              {authMessage}
            </p>
          )}

          <p className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthMessage("");
              }}
            >
              {authMode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="/">
          <span className="brand-icon">P</span>
          <span>
            Perspectra <strong>AI</strong>
          </span>
        </a>

        <nav className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#about">About</a>
        </nav>

                <div className="nav-account">
          <span className="nav-email">{session.user.email}</span>

          <button
            className="nav-button"
            onClick={() => {
              setShowSetup(false);
              document.getElementById("debate")?.scrollIntoView();
            }}
          >
            Get started
          </button>

          <button className="nav-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main>
        {!showSetup && !showDebate ? (
          <>
            <section className="hero">
              <div className="eyebrow">
                <span className="status-dot"></span>
                THINK CLEARER. ARGUE BETTER.
              </div>

              <h1>
                Every perspective
                <br />
                <span>makes you sharper.</span>
              </h1>

              <p className="hero-description">
                Challenge your ideas, explore different viewpoints, and build
                stronger arguments with your AI debate partner.
              </p>

              <div className="hero-actions">
                <a className="primary-button" href="#debate">
                  Start a debate <span>↗</span>
                </a>
                <a className="secondary-button" href="#how-it-works">
                  Explore how it works
                </a>
              </div>

              <div className="hero-note">
                <span>✦</span> Your ideas. Different perspectives. Better thinking.
              </div>
            </section>

            <section className="debate-section" id="debate">
              <div className="section-heading">
                <div>
                  <p className="section-label">YOUR NEXT CHALLENGE</p>
                  <h2>What do you want to debate?</h2>
                </div>
                <span className="step-count">01 / 03</span>
              </div>

              <div className="debate-card">
                <label htmlFor="topic">Choose a topic or enter your own</label>
                <input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Is AI making students more creative?"
                />

                <div className="topic-chips">
                  {topics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={topic === item ? "chip selected" : "chip"}
                      onClick={() => setTopic(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="card-divider"></div>

                <p className="choice-label">Choose your side</p>
                <div className="side-options">
                  <button
                    type="button"
                    className={
                      side === "for" ? "side-option selected" : "side-option"
                    }
                    onClick={() => setSide("for")}
                  >
                    <span className="side-symbol">+</span>
                    <span>
                      <strong>For the topic</strong>
                      <small>Support the statement</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      side === "against"
                        ? "side-option selected"
                        : "side-option"
                    }
                    onClick={() => setSide("against")}
                  >
                    <span className="side-symbol">−</span>
                    <span>
                      <strong>Against the topic</strong>
                      <small>Challenge the statement</small>
                    </span>
                  </button>
                </div>

                <button
                  className="start-button"
                  type="button"
                  onClick={continueToSetup}
                >
                  Continue to debate setup <span>→</span>
                </button>

                <p className="card-footnote">
                  Choose a topic and your side to continue.
                </p>
              </div>
            </section>

            <section className="how-section" id="how-it-works">
              <p className="section-label">BUILT FOR BETTER THINKING</p>
              <h2>More than just an argument.</h2>

              <div className="feature-grid">
                <article className="feature-card">
                  <span className="feature-number">01</span>
                  <h3>Challenge your ideas</h3>
                  <p>
                    Practice defending your viewpoint against a thoughtful AI
                    opponent.
                  </p>
                </article>

                <article className="feature-card">
                  <span className="feature-number">02</span>
                  <h3>See both perspectives</h3>
                  <p>
                    Explore counterarguments and consider different ways of
                    thinking.
                  </p>
                </article>

                <article className="feature-card">
                  <span className="feature-number">03</span>
                  <h3>Learn from your debate</h3>
                  <p>
                    Review your reasoning, argument clarity, and areas to
                    improve.
                  </p>
                </article>
              </div>
            </section>
                        <section className="about-section" id="about">
  <p className="section-label">ABOUT PERSPECTRA AI</p>

  <h2>
    Think beyond
    <br />
    <span>your perspective.</span>
  </h2>

  <p className="about-description">
    Perspectra AI is an AI-powered debate platform designed to help you
    explore ideas, challenge assumptions, and build stronger arguments
    through thoughtful discussions.
  </p>

  <div className="about-grid">
    <article className="about-card">
      <span className="feature-number">01</span>

      <h3>Our Mission</h3>

      <p>
        To make thoughtful discussions accessible and encourage people
        to understand different viewpoints.
      </p>
    </article>

    <article className="about-card">
      <span className="feature-number">02</span>

      <h3>Founded & Developed by Ammar Ansari</h3>

      <p>
        Perspectra AI was founded and developed by Ammar Ansari with
        the vision of making debate practice more interactive,
        accessible, and meaningful.
      </p>

      <div className="founder-contact">
        <a href="tel:+9120106944">
          +91 912-010-6944
        </a>

        <a href="mailto:ammarussalamansari@gmail.com">
          ammarussalamansari@gmail.com
        </a>
      </div>
    </article>

    <article className="about-card">
      <span className="feature-number">03</span>

      <h3>Learn Both Sides</h3>

      <p>
        Explore arguments for and against a topic and discover
        perspectives you may not have considered.
      </p>
    </article>
  </div>
</section>
          </>
        ) : showSetup ? (
          <section className="setup-section" id="debate">
            <button
              className="back-button"
              type="button"
              onClick={() => setShowSetup(false)}
            >
              ← Back to topic
            </button>

            <p className="section-label">DEBATE SETUP · STEP 02</p>
            <h1 className="setup-title">Make it your debate.</h1>
            <p className="setup-description">
              Review your topic and choose how you want to practice.
            </p>

            <div className="debate-card setup-card">
              <div className="summary-box">
                <span className="summary-label">YOUR TOPIC</span>
                <strong>{topic}</strong>
                <small>
                  Your side: {side === "for" ? "For the topic" : "Against the topic"}
                </small>
              </div>

              <label htmlFor="language">Debate language</label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option>English</option>
                <option>Hindi</option>
                <option>Hinglish</option>
              </select>

              <label htmlFor="difficulty">Difficulty level</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>

              <label htmlFor="rounds">Number of rounds</label>
              <select
                id="rounds"
                value={rounds}
                onChange={(event) => setRounds(event.target.value)}
              >
                <option value="2">2 rounds</option>
                <option value="3">3 rounds</option>
                <option value="5">5 rounds</option>
              </select>

              <button
                className="start-button"
                type="button"
                onClick={startDebate}
              >
                Start debate <span>→</span>
              </button>

              <p className="card-footnote">
                AI debate functionality will be connected next.
              </p>
            </div>
          
          </section>
        ) : (
          <section className="debate-room">
            <button
              className="back-button"
              type="button"
              onClick={() => {
                setShowDebate(false);
                setShowSetup(true);
              }}
            >
              ← Back to setup
            </button>

            <div className="room-header">
              <p className="section-label">LIVE DEBATE · ROUND {round}</p>
              <h1 className="setup-title">The floor is yours.</h1>
              <p className="room-topic">{topic}</p>

              <div className="room-details">
                <span>
                  Your side: {side === "for" ? "For" : "Against"}
                </span>
                <span>Language: {language}</span>
                <span>Level: {difficulty}</span>
              </div>
            </div>

            <div className="debate-chat">
              <div className="chat-heading">
                <div>
                  <span className="status-dot"></span>
                  AI Debate Partner
                </div>
                <span className="demo-badge">DEMO MODE</span>
              </div>

              <div className="chat-messages">
                {messages.map((message, index) => (
                  <article
                    key={index}
                    className={
                      message.speaker === "You"
                        ? "chat-message user-message"
                        : "chat-message ai-message"
                    }
                  >
                    <span className="message-speaker">
                      {message.speaker}
                    </span>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>

              <form
                className="chat-input-area"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write your argument..."
                  rows={3}
                />

                <div className="chat-input-footer">
                  <span>Round {round} of {rounds}</span>
                  <button
                  className="send-button"
                  type="submit"
                  disabled={!draft.trim() || loading}
>
                  {loading ? "AI is thinking..." : "Send argument →"}
                  </button>
                </div>
              </form>
            </div>

            <p className="card-footnote">
              Demo mode: AI replies are sample responses, not live AI.
            </p>
          </section>
        )}
      </main>


<footer className="site-footer">
  <a className="brand footer-brand" href="/">
    <span className="brand-icon">P</span>

    <span>
      Perspectra <strong>AI</strong>
    </span>
  </a>

  <div className="footer-meta">
    <p>
      Founded &amp; Developed by <strong>Ammar Ansari</strong>
    </p>

    <p>© 2026 Perspectra AI. All rights reserved.</p>
  </div>
</footer>
    </div>
  );
}

export default App;
