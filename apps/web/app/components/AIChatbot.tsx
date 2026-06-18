'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/auth-store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Vanakkam! Chef Katanguri here. Ask me anything about our authentic Warangal dishes, active orders, or get a recommendation!',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // Focus trap: trap Tab within the chat panel
  useEffect(() => {
    if (!isOpen) return;
    const panel = chatRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function handleTab(e: KeyboardEvent) {
      if (e.key === 'Escape') { setIsOpen(false); return; }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    panel.addEventListener('keydown', handleTab);
    inputRef.current?.focus();
    return () => panel.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Auto scroll to bottom of chat logs
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const activeText = textToSend || message;
    if (!activeText.trim()) return;

    if (!textToSend) setMessage('');
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, { role: 'user' as const, content: activeText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: activeText,
          history: newMessages,
        }),
      });

      if (!res.ok) throw new Error('Failed to get chat response');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered a temporary connection glitch. Please try asking again!',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (text: string) => {
    handleSend(text);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '50px',
            border: 'none',
            background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 25px rgba(226, 55, 68, 0.4)',
            cursor: 'pointer',
            fontFamily: '"Outfit", sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            transition: 'transform 0.2s, box-shadow 0.2s',
            animation: 'pulseBtn 2.5s infinite',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          <span style={{ fontSize: '18px' }}>💬</span>
          <span>Ask Chef Katanguri</span>
        </button>
      )}

      {/* Expandable Chat Panel */}
      {isOpen && (
        <div
          ref={chatRef}
          role="dialog"
          aria-label="AI Assistant Chat"
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            zIndex: 999,
            width: '380px',
            height: '520px',
            background: 'rgba(15, 15, 21, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '"Outfit", sans-serif',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, rgba(226, 55, 68, 0.15) 0%, rgba(0, 0, 0, 0) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '24px' }}>👨‍🍳</span>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '0px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: '1px solid #0f0f15',
                  }}
                />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Chef Katanguri</div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>AI support active</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              style={{
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                fontSize: '16px',
                cursor: 'pointer',
                width: 44,
                height: 44,
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '10px 16px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      fontSize: '13.5px',
                      lineHeight: '1.5',
                      textAlign: 'left',
                      color: '#ffffff',
                      background: isUser
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'linear-gradient(135deg, rgba(226, 55, 68, 0.25) 0%, rgba(198, 40, 40, 0.25) 100%)',
                      border: isUser
                        ? '1px solid rgba(255, 255, 255, 0.05)'
                        : '1px solid rgba(226, 55, 68, 0.15)',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  role="status"
                  aria-label="Chef is typing..."
                  style={{
                    background: 'rgba(226, 55, 68, 0.15)',
                    border: '1px solid rgba(226, 55, 68, 0.1)',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '12px 20px',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Chef is typing</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0s' }}>•</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.2s' }}>•</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.4s' }}>•</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick-reply Suggestion Chips */}
          <div
            style={{
              padding: '0 20px 10px',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none', // hide on Firefox
              msOverflowStyle: 'none', // hide on IE
            }}
          >
            {[
              'Suggest veg recommendations 🥦',
              'Check my order status 📦',
              'Is there non-veg today? 🍗',
            ].map((text) => (
              <button
                key={text}
                onClick={() => handleQuickReply(text)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#d4d4d8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                {text}
              </button>
            ))}
          </div>

          {/* Input Panel */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything..."
              aria-label="Type your message"
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(226, 55, 68, 0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseBtn {
          0% { box-shadow: 0 8px 25px rgba(226, 55, 68, 0.4); }
          50% { box-shadow: 0 8px 30px rgba(226, 55, 68, 0.65); transform: scale(1.02); }
          100% { box-shadow: 0 8px 25px rgba(226, 55, 68, 0.4); }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounceDot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}} />
    </>
  );
}
