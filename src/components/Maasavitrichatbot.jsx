import { useState, useRef, useEffect, useCallback } from "react";
import logo from "../assets/logo.jpg";

const API_URL = "https://ask-question-server-rosy.vercel.app/api/chat";
const HEALTH_URL = "https://ask-question-server-rosy.vercel.app/api/health";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 8000;

function generateSessionId() {
  return "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
}

const LANG_QUICK_REPLIES = ["🇬🇧 English", "🇮🇳 हिंदी में बात करें"];
const POST_LANG_EN = [
  "Teacher recruitment",
  "School registration fees",
  "How does placement work?",
  "I'm a teacher looking for a job",
];
const POST_LANG_HI = [
  "शिक्षक भर्ती",
  "स्कूल शुल्क जानकारी",
  "प्लेसमेंट कैसे होती है?",
  "मुझे नौकरी चाहिए",
];

export default function MaaSavitriChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Namaste! 🙏 Welcome to Maa Savitri Consultancy Services.\n\nPlease select your preferred language:\n🇬🇧 English  |  🇮🇳 हिंदी",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [quickReplies, setQuickReplies] = useState(LANG_QUICK_REPLIES);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [language, setLanguage] = useState(null);
  const [serverStatus, setServerStatus] = useState("checking");
  const [retryCount, setRetryCount] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const retryTimerRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    let attempts = 0;
    const MAX_WAKE_ATTEMPTS = 10;
    const ping = async () => {
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10000) });
        if (res.ok) { setServerStatus("online"); return; }
      } catch { /* still waking */ }
      attempts++;
      if (attempts < MAX_WAKE_ATTEMPTS) {
        setServerStatus("waking");
        setTimeout(ping, 6000);
      } else {
        setServerStatus("offline");
      }
    };
    ping();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (serverStatus === "online") inputRef.current?.focus();
  }, [serverStatus]);

  const startCountdown = useCallback((seconds) => {
    setRetrySeconds(seconds);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRetrySeconds((s) => {
        if (s <= 1) { clearInterval(countdownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {
    clearTimeout(retryTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const sendMessage = async (text, attempt = 0) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    if (!language) {
      if (messageText.includes("English") || messageText.includes("🇬🇧")) {
        setLanguage("en"); setQuickReplies(POST_LANG_EN);
      } else if (messageText.includes("हिंदी") || messageText.includes("🇮🇳")) {
        setLanguage("hi"); setQuickReplies(POST_LANG_HI);
      }
    }

    if (attempt === 0) {
      setInput("");
      setShowQuickReplies(false);
      setRetryCount(0);
      setMessages((prev) => [...prev, { role: "user", text: messageText, time: new Date() }]);
    }

    setIsLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, sessionId }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.reply) throw new Error("No reply");

      setServerStatus("online");
      setRetryCount(0);
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply, time: new Date() }]);
      setShowQuickReplies(true);
      setIsLoading(false);
    } catch {
      if (attempt < MAX_RETRIES) {
        const nextAttempt = attempt + 1;
        setRetryCount(nextAttempt);
        setServerStatus("waking");
        startCountdown(RETRY_DELAY_MS / 1000);
        retryTimerRef.current = setTimeout(() => sendMessage(messageText, nextAttempt), RETRY_DELAY_MS);
      } else {
        setIsLoading(false);
        setRetryCount(0);
        setServerStatus("offline");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: language === "hi"
              ? "माफ़ करें, सर्वर अभी उपलब्ध नहीं है। कृपया कुछ देर बाद पुनः प्रयास करें।"
              : "Sorry, the server is taking too long to respond. Please wait a moment and try again.",
            time: new Date(),
            isError: true,
          },
        ]);
        setShowQuickReplies(true);
      }
    }
  };

  const handleNewChat = () => {
    clearTimeout(retryTimerRef.current);
    clearInterval(countdownRef.current);
    setMessages([{
      role: "assistant",
      text: "Namaste! 🙏 Welcome to Maa Savitri Consultancy Services.\n\nPlease select your preferred language:\n🇬🇧 English  |  🇮🇳 हिंदी",
      time: new Date(),
    }]);
    setInput("");
    setLanguage(null);
    setQuickReplies(LANG_QUICK_REPLIES);
    setShowQuickReplies(true);
    setRetryCount(0);
    setIsLoading(false);
  };

  const fmt = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const isInputDisabled = isLoading || serverStatus === "checking" || serverStatus === "waking";

  const StatusBanner = () => {
    if (serverStatus === "online") return null;
    const cfg = {
      checking: { bg: "#fff8e1", border: "#f39c12", color: "#7d5a00", dot: "#f39c12", text: "Connecting to server..." },
      waking: {
        bg: "#fff3cd", border: "#f0ad4e", color: "#7d5a00", dot: "#f39c12",
        text: retryCount > 0
          ? `Server is waking up — retry ${retryCount}/${MAX_RETRIES} in ${retrySeconds}s...`
          : "Server is waking up from sleep. Please wait (~30 sec)...",
      },
      offline: { bg: "#fdecea", border: "#e74c3c", color: "#a93226", dot: "#e74c3c", text: "Server offline. Try refreshing." },
    }[serverStatus];
    if (!cfg) return null;
    return (
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "8px", padding: "8px 12px", margin: "8px 12px 0", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: cfg.color }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.dot, flexShrink: 0, animation: serverStatus !== "offline" ? "pulse 1.5s infinite" : "none" }} />
        {cfg.text}
        {serverStatus === "offline" && (
          <button onClick={() => window.location.reload()} style={{ marginLeft: "auto", background: "#e74c3c", color: "#fff", border: "none", borderRadius: "5px", padding: "3px 10px", fontSize: "11px", cursor: "pointer" }}>
            Retry
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="chat-root">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .chat-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          font-family: 'Segoe UI', Tahoma, sans-serif;
          background: #eaf0f6;
          overflow: hidden;
        }

        /* ── Header ── */
        .chat-header {
          background: #1a5276;
          padding: 0 16px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
        }
        .chat-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .chat-logo {
          width: 42px; height: 42px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0;
          border: 2px solid #f39c12;
        }
        .chat-title { color: #fff; font-weight: 600; font-size: 14px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-subtitle { color: #a9cce3; font-size: 11px; display: flex; align-items: center; gap: 5px; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

        .ncbtn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff; border-radius: 8px;
          padding: 6px 12px; font-size: 12px;
          cursor: pointer; display: flex; align-items: center; gap: 5px;
          white-space: nowrap; flex-shrink: 0;
          transition: background 0.15s;
        }
        .ncbtn:hover { background: rgba(255,255,255,0.2); }

        /* ── Body ── */
        .chat-body { display: flex; flex: 1; overflow: hidden; }

        /* ── Sidebar ── */
        .sidebar {
          width: 240px; background: #fff;
          border-right: 1px solid #dde3ea;
          display: flex; flex-direction: column;
          flex-shrink: 0; padding: 16px 12px;
          gap: 8px; overflow-y: auto;
        }
        .sidebar-label { font-size: 10px; font-weight: 700; color: #95a5a6; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2px; }
        .svc-btn {
          background: none; border: 1px solid #eaecee;
          border-radius: 10px; padding: 9px 10px;
          cursor: pointer; text-align: left;
          display: flex; align-items: flex-start; gap: 9px;
          width: 100%; transition: background 0.15s;
        }
        .svc-btn:hover:not(:disabled) { background: #e8f4fc; }
        .svc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .svc-icon { font-size: 18px; line-height: 1.1; flex-shrink: 0; }
        .svc-name { font-size: 12px; font-weight: 600; color: #1a5276; }
        .svc-desc { font-size: 11px; color: #95a5a6; margin-top: 2px; }
        .sidebar-contact { margin-top: auto; background: #f0f7fc; border-radius: 10px; padding: 11px; border: 1px solid #d4e6f1; }
        .sidebar-contact-title { font-size: 11px; font-weight: 700; color: #1a5276; margin-bottom: 5px; }
        .sidebar-contact-text { font-size: 11px; color: #5d6d7e; line-height: 1.8; }

        /* ── Chat Panel ── */
        .chat-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #f4f8fb; min-width: 0; }

        /* ── Messages ── */
        .messages-area { flex: 1; overflow-y: auto; padding: 14px 14px 6px; display: flex; flex-direction: column; gap: 12px; }
        .messages-inner { max-width: 720px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }

        .msg-wrap { display: flex; flex-direction: column; gap: 3px; }
        .msg-wrap.user { align-items: flex-end; }
        .msg-wrap.assistant { align-items: flex-start; }

        .msg-row { display: flex; align-items: flex-end; gap: 7px; }
        .msg-row.user { flex-direction: row-reverse; }

        .msg-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: #fff;
        }
        .msg-avatar.user { background: #2980b9; }
        .msg-avatar.assistant { background: #f39c12; }
        .msg-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

        .msg-bubble {
          max-width: 72%; padding: 10px 13px;
          font-size: 13.5px; line-height: 1.65;
          box-shadow: 0 1px 4px rgba(0,0,0,0.07);
          white-space: pre-wrap; word-break: break-word;
        }
        .msg-bubble.user { background: #1a5276; color: #fff; border-radius: 18px 18px 4px 18px; }
        .msg-bubble.assistant { background: #fff; color: #2c3e50; border: 1px solid #dde3ea; border-radius: 18px 18px 18px 4px; }
        .msg-bubble.error { background: #fdecea; color: #c0392b; border: none; }

        .msg-time { font-size: 10px; color: #aab4be; }
        .msg-time.user { padding-right: 37px; }
        .msg-time.assistant { padding-left: 37px; }

        /* Typing indicator */
        .typing-bubble { padding: 12px 14px; background: #fff; border-radius: 18px 18px 18px 4px; border: 1px solid #dde3ea; display: flex; flex-direction: column; gap: 5px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); min-width: 100px; }
        .typing-dots { display: flex; gap: 5px; align-items: center; }
        .retry-text { font-size: 11px; color: #e67e22; }

        /* ── Quick Replies — inline in message flow ── */
        .inline-quick { display: flex; flex-wrap: wrap; gap: 7px; padding-left: 37px; padding-top: 2px; }
        .qbtn {
          background: #eaf4fc; border: 1px solid #aed6f1;
          color: #1a5276; border-radius: 20px;
          padding: 6px 13px; font-size: 12.5px;
          cursor: pointer; font-weight: 500; transition: all 0.15s;
        }
        .qbtn:hover:not(:disabled) { background: #d0e8f5; border-color: #5dade2; }
        .qbtn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Input Bar ── */
        .input-bar { padding: 10px 14px 12px; background: #fff; border-top: 1px solid #dde3ea; flex-shrink: 0; }
        .input-inner { max-width: 720px; margin: 0 auto; display: flex; gap: 9px; align-items: center; }
        .ifield {
          flex: 1; border: 1.5px solid #d5dbdb; border-radius: 25px;
          padding: 10px 16px; font-size: 14px; color: #2c3e50;
          background: #f7f9fb; transition: border-color 0.2s, background 0.2s;
          min-width: 0;
        }
        .ifield:focus { border-color: #1a5276; background: #fff; outline: none; }
        .ifield:disabled { background: #f0f0f0; cursor: not-allowed; }

        .sbtn {
          width: 44px; height: 44px; border-radius: 50%;
          border: none; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0; transition: background 0.2s;
        }
        .sbtn:not(:disabled) { background: #1a5276; cursor: pointer; }
        .sbtn:not(:disabled):hover { background: #154360; }
        .sbtn:disabled { background: #bdc3c7; cursor: not-allowed; }

        /* ── Footer ── */
        .chat-footer { text-align: center; padding: 5px 0 7px; font-size: 10.5px; color: #aab4be; background: #fff; border-top: 1px solid #f0f0f0; flex-shrink: 0; }

        /* ── Animations ── */
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .msg-in { animation: fadeUp 0.2s ease; }
        .d1{animation:bounce 1.2s infinite 0s}
        .d2{animation:bounce 1.2s infinite 0.2s}
        .d3{animation:bounce 1.2s infinite 0.4s}

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #ccd6dd; border-radius: 10px; }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .sidebar { display: none !important; }
          .chat-title { font-size: 13px; }
          .messages-area { padding: 10px 10px 4px; }
          .msg-bubble { max-width: 82%; font-size: 13px; }
          .inline-quick { padding-left: 0; }
          .input-bar { padding: 8px 10px 10px; }
          .ncbtn span { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <img src={logo} alt="Maa Savitri Logo" className="chat-logo" />
          <div style={{ minWidth: 0 }}>
            <div className="chat-title">Maa Savitri Consultancy Services</div>
            <div className="chat-subtitle">
              <span
                className="status-dot"
                style={{
                  background: serverStatus === "online" ? "#2ecc71" : serverStatus === "offline" ? "#e74c3c" : "#f39c12",
                  animation: serverStatus === "waking" || serverStatus === "checking" ? "pulse 1.5s infinite" : "none",
                }}
              />
              {serverStatus === "online" ? "AI Assistant · Siwan, Bihar"
                : serverStatus === "waking" ? "Server waking up..."
                : serverStatus === "checking" ? "Connecting..."
                : "Server offline"}
            </div>
          </div>
        </div>
        <button className="ncbtn" onClick={handleNewChat}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Body */}
      <div className="chat-body">

        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-label">Our Services</div>
          {[
            { icon: "👨🏫", label: "Teacher Recruitment", desc: "Qualified educators for schools" },
            { icon: "🏫", label: "School Staffing", desc: "Non-teaching staff placement" },
            { icon: "📢", label: "Admission Campaigns", desc: "Boost student enrollment" },
            { icon: "🌐", label: "Website Designing", desc: "Professional school websites" },
            { icon: "📣", label: "Advertising & Promotion", desc: "Brand your institution" },
          ].map((s) => (
            <button key={s.label} className="svc-btn" onClick={() => sendMessage(s.label)} disabled={isInputDisabled}>
              <span className="svc-icon">{s.icon}</span>
              <div>
                <div className="svc-name">{s.label}</div>
                <div className="svc-desc">{s.desc}</div>
              </div>
            </button>
          ))}
          <div className="sidebar-contact">
            <div className="sidebar-contact-title">📍 Contact Us</div>
            <div className="sidebar-contact-text">Siwan, Bihar<br />Serving Bihar &amp; Eastern UP</div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="chat-panel">
          <StatusBanner />

          {/* Messages */}
          <div className="messages-area">
            <div className="messages-inner">
              {messages.map((msg, i) => (
                <div key={i} className={`msg-in msg-wrap ${msg.role}`}>
                  <div className={`msg-row ${msg.role}`}>
                    <div className={`msg-avatar ${msg.role}`}>
                      {msg.role === "assistant"
                        ? <img src={logo} alt="MS" />
                        : "U"}
                    </div>
                    <div className={`msg-bubble ${msg.role}${msg.isError ? " error" : ""}`}>
                      {msg.text}
                    </div>
                  </div>
                  <div className={`msg-time ${msg.role}`}>{fmt(msg.time)}</div>
                </div>
              ))}

              {isLoading && (
                <div className="msg-in msg-wrap assistant">
                  <div className="msg-row assistant">
                    <div className="msg-avatar assistant">
                      <img src={logo} alt="MS" />
                    </div>
                    <div className="typing-bubble">
                      <div className="typing-dots">
                        {["d1", "d2", "d3"].map((c) => (
                          <div key={c} className={c} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#95a5a6" }} />
                        ))}
                      </div>
                      {retryCount > 0 && (
                        <div className="retry-text">
                          ⏳ Waking server... retry {retryCount}/{MAX_RETRIES}{retrySeconds > 0 && ` (${retrySeconds}s)`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Replies — inline below last message */}
              {showQuickReplies && quickReplies.length > 0 && !isLoading && (
                <div className="msg-in inline-quick">
                  {quickReplies.map((qr) => (
                    <button key={qr} className="qbtn" onClick={() => sendMessage(qr)} disabled={isInputDisabled}>
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div className="input-bar">
            <div className="input-inner">
              <input
                ref={inputRef}
                className="ifield"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !isInputDisabled && sendMessage()}
                placeholder={
                  serverStatus === "checking" ? "Connecting to server..." :
                  serverStatus === "waking" ? "Server waking up, please wait..." :
                  serverStatus === "offline" ? "Server offline — please refresh" :
                  language === "hi" ? "अपना संदेश लिखें..." : "Type your message here..."
                }
                disabled={isInputDisabled}
              />
              <button className="sbtn" onClick={() => sendMessage()} disabled={!input.trim() || isInputDisabled}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="chat-footer">
            Maa Savitri Consultancy Services · Siwan, Bihar · Powered by AI
          </div>
        </div>
      </div>
    </div>
  );
}
