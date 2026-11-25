import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import api from '../services/api';

marked.setOptions({ breaks: true, gfm: true });

const CHATBOT_URL  = (process.env.REACT_APP_API_URL || 'http://172.16.11.243:8001')
  .replace(':8001', ':5001');
const INTERNAL_TOK = 'noc-drill-internal-2024';

const IcoChat  = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
);
const IcoSend  = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);
const IcoClose = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);
const IcoShield = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);

export default function ChatWidget() {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState('');
  const [messages,setMessages]= useState([
    { role: 'bot', text: 'Hello! I\'m the NOC Policy Assistant. Ask me anything about company policies, procedures, or security guidelines.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [unread,  setUnread]  = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      // Build history as {question, answer} pairs — the format aiService expects
      const history = [];
      const conv = messages.filter(m => m.role === 'user' || m.role === 'bot');
      for (let i = 0; i < conv.length - 1; i++) {
        if (conv[i].role === 'user' && conv[i + 1]?.role === 'bot') {
          history.push({ question: conv[i].text, answer: conv[i + 1].text });
          i++; // skip the bot message we just paired
        }
      }
      const res = await fetch(`${CHATBOT_URL}/api/chat/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${INTERNAL_TOK}`,
        },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      const answer = data.answer || data.error || 'No response received.';
      setMessages(m => [...m, { role: 'bot', text: answer }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button className="cw-toggle" onClick={() => setOpen(o => !o)} title="NOC Policy Assistant">
        {open ? <IcoClose /> : <IcoChat />}
        {!open && unread > 0 && <span className="cw-badge">{unread}</span>}
      </button>

      {/* Chat window */}
      {open && (
        <div className="cw-window">
          {/* Header */}
          <div className="cw-header">
            <div className="cw-header-icon"><IcoShield /></div>
            <div className="cw-header-info">
              <div className="cw-header-title">NOC Policy Assistant</div>
              <div className="cw-header-status">
                <span className="cw-dot" />
                <span>Online — Ready to help</span>
              </div>
            </div>
            <button className="cw-close" onClick={() => setOpen(false)}><IcoClose /></button>
          </div>

          {/* Messages */}
          <div className="cw-messages">
            {messages.map((m, i) => (
              <div key={i} className={`cw-msg cw-msg--${m.role}`}>
                {m.role === 'bot' && <div className="cw-avatar"><IcoShield /></div>}
                {m.role === 'bot'
                  ? <div className="cw-bubble cw-bubble--md" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) }} />
                  : <div className="cw-bubble">{m.text}</div>
                }
              </div>
            ))}
            {loading && (
              <div className="cw-msg cw-msg--bot">
                <div className="cw-avatar"><IcoShield /></div>
                <div className="cw-bubble cw-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="cw-input-row">
            <input
              ref={inputRef}
              className="cw-input"
              placeholder="Ask about policies, SOPs, procedures…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button className="cw-send" onClick={send} disabled={loading || !input.trim()}>
              <IcoSend />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
