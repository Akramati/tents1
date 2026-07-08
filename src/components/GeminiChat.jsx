"use client";
import { useState, useRef, useEffect, useCallback } from "react";

export default function GeminiChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "👋 مرحباً! أنا المساعد الذكي لنظام هابي لاند. يمكنك أن تطلب مني:\n- طباعة كشف حساب عميل\n- تسديد دفعة\n- فحص إتاحة تاريخ\n- الاستعلام عن رصيد مورد" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSent, setVoiceSent] = useState(false);
  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[❌⚠️✅👋⏳]/g, ""));
    utterance.lang = "ar-SA";
    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const wasVoice = voiceSent;
    setVoiceSent(false);
    setInput("");
    setError("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) { setError("❌ الرجاء تسجيل الدخول أولاً"); setLoading(false); return; }

      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, token }),
      });
      const d = await r.json();
      if (d.success) {
        setMessages(prev => [...prev, { role: "assistant", text: d.reply }]);
        if (wasVoice) speak(d.reply);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: `❌ ${d.error || "حدث خطأ"}` }]);
      }
    } catch {
      setError("❌ فشل الاتصال بالسيرفر");
    }
    setLoading(false);
  }, [input, loading, voiceSent, speak]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("❌ المتصفح لا يدعم الإدخال الصوتي");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => { setIsListening(false); setError("❌ حدث خطأ أثناء الاستماع"); };
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setVoiceSent(true);
      setTimeout(() => handleSend(transcript), 100);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="gemini-chat-modal">
        <div className="gemini-chat-header">
          <span>🤖 المساعد الذكي</span>
          {onClose && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>

        <div className="gemini-chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`gemini-msg ${m.role === "user" ? "user" : "assistant"}`}>
              <div className="gemini-msg-bubble">{m.text}</div>
              {m.role === "assistant" && window.speechSynthesis && (
                <button className="speaker-btn" onClick={() => speak(m.text)} title="استماع">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.5 4.5 0 0 0 2.5-3.5zm2.5 0A7 7 0 0 0 16 5.07V2.8A9.2 9.2 0 0 1 20 12a9.2 9.2 0 0 1-4 7.2v-2.27A7 7 0 0 0 19 12z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
          {loading && <div className="gemini-msg assistant"><div className="gemini-msg-bubble loading">⏳ جاري التنفيذ...</div></div>}
          {error && <div className="gemini-msg assistant"><div className="gemini-msg-bubble error">{error}</div></div>}
          <div ref={bottomRef} />
        </div>

        <div className="gemini-chat-input-row">
          <textarea
            className="form-control"
            rows="2"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب أمرك هنا..."
            disabled={loading}
          />
          <button className={`mic-btn ${isListening ? "listening" : ""}`} onClick={toggleVoice} disabled={loading} title={isListening ? "إيقاف التسجيل" : "تسجيل صوتي"}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z"/>
              <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2z"/>
            </svg>
          </button>
          <button className="btn btn-primary" onClick={() => handleSend()} disabled={loading || !input.trim()}>
            {loading ? "..." : "إرسال"}
          </button>
        </div>

        <style jsx>{`
          .gemini-chat-modal {
            background: var(--card-bg);
            border-radius: 20px;
            max-width: 560px;
            width: 100%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            direction: rtl;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .gemini-chat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.25rem;
            border-bottom: 2px solid var(--card-border);
            font-weight: bold;
            font-size: 1.1rem;
          }
          .gemini-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            min-height: 300px;
            max-height: 60vh;
          }
          .gemini-msg { display: flex; }
          .gemini-msg.user { justify-content: flex-end; }
          .gemini-msg.assistant { justify-content: flex-start; }
          .gemini-msg-bubble {
            max-width: 85%;
            padding: 0.75rem 1rem;
            border-radius: 16px;
            font-size: 0.9rem;
            line-height: 1.5;
            white-space: pre-wrap;
            background: rgba(255,255,255,0.08);
            border: 1px solid var(--card-border);
          }
          .gemini-msg.user .gemini-msg-bubble {
            background: var(--secondary);
            color: var(--primary);
            border-color: var(--secondary);
          }
          .gemini-msg-bubble.loading { opacity: 0.6; }
          .gemini-msg-bubble.error { color: #ef4444; }
          .gemini-chat-input-row {
            display: flex;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-top: 1px solid var(--card-border);
            align-items: flex-end;
          }
          .gemini-chat-input-row textarea { flex: 1; resize: none; }
          .gemini-chat-input-row button { white-space: nowrap; min-width: 80px; }
          .mic-btn {
            background: transparent;
            border: 2px solid var(--card-border);
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--text-color);
            flex-shrink: 0;
            padding: 0;
          }
          .mic-btn:hover { border-color: var(--secondary); background: rgba(255,255,255,0.05); }
          .mic-btn:disabled { opacity: 0.4; cursor: not-allowed; }
          .mic-btn.listening {
            border-color: #ef4444;
            color: #ef4444;
            animation: pulse 1.2s ease-in-out infinite;
            box-shadow: 0 0 12px rgba(239,68,68,0.4);
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.7; }
          }
          .speaker-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--text-color);
            opacity: 0.5;
            padding: 4px;
            display: flex;
            align-items: center;
            transition: opacity 0.2s;
            flex-shrink: 0;
            align-self: flex-end;
            margin-bottom: 4px;
          }
          .speaker-btn:hover { opacity: 1; }
          @media (max-width: 600px) {
            .gemini-chat-modal { max-width: 100vw; border-radius: 0; max-height: 100vh; }
            .gemini-chat-messages { min-height: 200px; max-height: 70vh; }
          }
        `}</style>
      </div>
    </div>
  );
}