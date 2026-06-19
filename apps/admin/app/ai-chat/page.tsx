'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAuthHeaders } from '../../lib/auth-headers';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Insight {
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestion?: string;
}

export default function AIChatPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Katanguri AI Operations Console active. I can answer questions about your live inventory, today\'s sales, and promotional strategy.\n\nTry asking:\n• "What stock is below par level?"\n• "Show me today\'s sales summary"\n• "Suggest a promotional discount"\n\nFor full LLM-powered analysis, add GROQ_API_KEY or GEMINI_API_KEY to your .env file.',
    },
  ]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const mainEl = document.querySelector('main.admin-main') as HTMLElement;
    if (mainEl) {
      const originalOverflow = mainEl.style.overflow;
      const originalPadding = mainEl.style.padding;
      const originalHeight = mainEl.style.height;
      const originalBg = mainEl.style.backgroundColor;
      
      const checkAndStyleMain = () => {
        const mobile = window.matchMedia('(max-width: 768px)').matches;
        mainEl.style.overflow = 'hidden';
        mainEl.style.padding = mobile ? '12px' : '16px';
        mainEl.style.height = mobile ? 'calc(100vh - 56px)' : '100vh';
        mainEl.style.backgroundColor = '#0b0f19';
      };
      
      checkAndStyleMain();
      window.addEventListener('resize', checkAndStyleMain);
      
      return () => {
        window.removeEventListener('resize', checkAndStyleMain);
        mainEl.style.overflow = originalOverflow;
        mainEl.style.padding = originalPadding;
        mainEl.style.height = originalHeight;
        mainEl.style.backgroundColor = originalBg;
      };
    }
  }, []);

  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading]);

  useEffect(() => {
    async function loadInsights() {
      try {
        const res = await fetch('/api/v1/admin/ai/insights', {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setInsights(data.insights || []);
        }
      } catch (err) {
        console.error('Failed to load insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    }
    loadInsights();
  }, []);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || message;
    if (!text.trim()) return;

    if (!textToSend) setMessage('');
    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch('/api/v1/admin/ai/chat/insights', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: text,
          history: newMessages,
        }),
      });

      if (!res.ok) throw new Error('Response error');
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Error: Failed to communicate with the operations server. Please check connection.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '320px 1fr',
      gridTemplateRows: isMobile ? 'auto 1fr' : 'none',
      height: '100%',
      gap: isMobile ? '12px' : '24px',
      color: '#e5e7eb',
      fontFamily: '"Outfit", system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Left Column: Operational Insights */}
      <div style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: isMobile ? '16px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        maxHeight: isMobile ? '150px' : undefined,
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, borderBottom: '1px solid #1f2937', paddingBottom: '12px' }}>
          Operations Overview
        </h2>

        {loadingInsights ? (
          <div style={{ color: '#9ca3af', fontSize: '14px' }}>Loading metrics...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {insights.length === 0 ? (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontSize: '13px',
              }}>
                ✓ All operations healthy. No critical low-stock alerts.
              </div>
            ) : (
              insights.map((ins, i) => {
                const isHigh = ins.severity === 'high';
                const isMedium = ins.severity === 'medium';
                const color = isHigh ? '#f87171' : isMedium ? '#fbbf24' : '#60a5fa';
                const bg = isHigh ? 'rgba(239, 68, 68, 0.05)' : isMedium ? 'rgba(245, 158, 11, 0.05)' : 'rgba(59, 130, 246, 0.05)';
                const border = isHigh ? 'rgba(239, 68, 68, 0.2)' : isMedium ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)';
                return (
                  <div
                    key={i}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: bg,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color }}>●</span>
                      <strong style={{ fontSize: '13.5px', color: '#ffffff' }}>{ins.title}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>{ins.description}</div>
                    {ins.suggestion && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color,
                        borderTop: `1px solid ${border}`,
                        paddingTop: '6px',
                      }}>
                        💡 {ins.suggestion}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right Column: Chat console */}
      <div style={{
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
        }}>
          <span style={{ fontSize: '24px' }}>💬</span>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Operations AI Copilot</h2>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>Groq-powered decision assistant</p>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={chatContainerRef} style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
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
                <div style={{
                  maxWidth: '75%',
                  padding: '12px 18px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isUser ? '#1f2937' : '#1e1b4b',
                  border: isUser ? '1px solid #374151' : '1px solid #312e81',
                  textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: '11px',
                    color: isUser ? '#9ca3af' : '#818cf8',
                    fontWeight: 700,
                    marginBottom: '4px',
                  }}>
                    {isUser ? 'Manager' : 'Operations Copilot'}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#ffffff',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}

          {chatLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: '#1e1b4b',
                border: '1px solid #312e81',
                borderRadius: '16px 16px 16px 4px',
                padding: '12px 20px',
                color: '#9ca3af',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>Copilot is compiling data</span>
                <span style={{ animation: 'bounceDot 1.4s infinite' }}>•</span>
                <span style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.2s' }}>•</span>
                <span style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.4s' }}>•</span>
              </div>
            </div>
          )}
        </div>

        {/* Suggestion Chips */}
        <div style={{
          padding: '0 24px 12px 24px',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {[
            'Report today\'s sales summary 📈',
            'What stock is below par level?',
            'Suggest a promotional discount 🏷️',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: '12px',
                border: '1px solid #374151',
                background: '#1f2937',
                color: '#d1d5db',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#374151')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#1f2937')}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input area */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{
            padding: '20px 24px',
            borderTop: '1px solid #1f2937',
            display: 'flex',
            gap: '12px',
            background: '#0b0f19',
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask operations co-pilot..."
            style={{
              flex: 1,
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '12px',
              padding: '12px 16px',
              color: '#ffffff',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = '#374151')}
          />
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Submit
          </button>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounceDot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}} />
    </div>
  );
}
