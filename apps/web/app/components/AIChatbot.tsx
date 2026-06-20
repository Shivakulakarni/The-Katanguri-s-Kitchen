'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../lib/auth-store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SMART_ACTIONS = [
  { label: 'Recommend dishes', icon: '✨', message: 'What do you recommend for me today?' },
  { label: 'Plan a meal', icon: '📋', message: '__MEAL_PLAN__' },
  { label: 'Veg options', icon: '🥦', message: 'Show me the best vegetarian dishes' },
  { label: 'Spicy picks', icon: '🌶️', message: 'What are your spiciest dishes?' },
  { label: 'Budget meal', icon: '💰', message: '__MEAL_PLAN_BUDGET__' },
  { label: 'Food story', icon: '📖', message: '__FOOD_STORY__' },
];

const TIME_GREETINGS: Record<string, string> = {
  morning: 'Good morning! Ready to start your day with something delicious?',
  afternoon: 'Good afternoon! Perfect time for a hearty lunch.',
  evening: 'Good evening! What sounds good for tonight?',
  night: 'Late night craving? We have just the thing.',
};

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSmartActions, setShowSmartActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // Initialize with time-aware greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const timeOfDay = getTimeOfDay();
      const greeting = TIME_GREETINGS[timeOfDay];
      const name = user?.name ? ` ${user.name.split(' ')[0]}` : '';
      setMessages([{
        role: 'assistant',
        content: `Vanakkam${name}! 👨‍🍳 Chef Katanguri here. ${greeting}\n\nI can help you find the perfect dish, plan a meal, or tell you the story behind our recipes. What would you like?`,
      }]);
    }
  }, [isOpen, messages.length, user]);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(async (textToSend?: string) => {
    const activeText = textToSend || message;
    if (!activeText.trim()) return;

    if (!textToSend) setMessage('');
    setShowSmartActions(false);
    const currentMessages = messagesRef.current;
    const newMessages = [...currentMessages, { role: 'user' as const, content: activeText }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Intercept meal plan requests
      if (activeText === '__MEAL_PLAN__' || activeText === '__MEAL_PLAN_BUDGET__') {
        const isBudget = activeText === '__MEAL_PLAN_BUDGET__';
        setMessages([...newMessages, { role: 'assistant', content: 'Chef Katanguri is crafting your personalized meal plan... 🍽️' }]);

        const hour = new Date().getHours();
        let mealType = 'lunch';
        if (hour >= 5 && hour < 11) mealType = 'breakfast';
        else if (hour >= 11 && hour < 17) mealType = 'lunch';
        else if (hour >= 17 && hour < 21) mealType = 'dinner';
        else mealType = 'snack';

        const res = await fetch('/api/v1/ai/meal-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            mealType,
            budget: isBudget ? 200 : 300,
            dietary: 'No restrictions',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const plan = data.mealPlan;
          const dishList = plan.dishes.map((d: any) => `• ${d.name} — ₹${d.price}\n  ${d.reason}`).join('\n');
          const response = `📋 **${plan.mealType.charAt(0).toUpperCase() + plan.mealType.slice(1)} Meal Plan**\n\n${dishList}\n\n💰 Total: ₹${plan.totalPrice}\n\n🍽️ ${plan.pairingNote}\n\n👨‍🍳 Chef's Tip: ${plan.chefTip}`;
          setMessages([...newMessages, { role: 'assistant', content: response }]);
        } else {
          setMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't generate a meal plan right now. Let me suggest something from our menu instead! What type of food are you in the mood for?" }]);
        }
        setIsLoading(false);
        return;
      }

      // Intercept food story requests
      if (activeText === '__FOOD_STORY__') {
        setMessages([...newMessages, { role: 'assistant', content: 'Let me find a dish with a great story... 📖' }]);

        const menuRes = await fetch('/api/v1/menu');
        if (menuRes.ok) {
          const categories = await menuRes.json();
          const allDishes = categories.flatMap((c: any) => c.dishes || []);
          const randomDish = allDishes[Math.floor(Math.random() * allDishes.length)];

          if (randomDish) {
            const storyRes = await fetch(`/api/v1/ai/food-story/${randomDish.id}`);
            if (storyRes.ok) {
              const storyData = await storyRes.json();
              setMessages([...newMessages, {
                role: 'assistant',
                content: `📖 **${storyData.dishName}**\n\n${storyData.story}\n\nWould you like to add ${storyData.dishName} to your cart? 🛒`,
              }]);
            } else {
              setMessages([...newMessages, { role: 'assistant', content: "I'd love to tell you about our signature Hyderabadi Biryani! It uses the dum pukht method, sealed with dough to trap every aromatic note. Want to try it?" }]);
            }
          }
        } else {
        }
        setIsLoading(false);
        return;
      }

      // Regular chat message — use streaming for real-time feel
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      const res = await fetch('/api/v1/ai/chat/customer/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: activeText,
          history: newMessages.slice(-10),
        }),
      });

      if (!res.ok || !res.body) {
        // Fallback to non-streaming
        const fallbackRes = await fetch('/api/v1/ai/chat/customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: activeText, history: newMessages.slice(-10) }),
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setMessages([...newMessages, { role: 'assistant', content: data.response }]);
        } else {
          setMessages([...newMessages, { role: 'assistant', content: 'Sorry, Chef Katanguri is taking a quick break. Please try again!' }]);
        }
        setIsLoading(false);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullContent += data.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                  return updated;
                });
              } else if (data.type === 'done') {
                // Stream complete
              } else if (data.type === 'error') {
                fullContent = data.message || 'Sorry, something went wrong.';
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                  return updated;
                });
              }
            } catch { /* skip malformed */ }
          }
        }
      }

      // Final update with complete content
      if (fullContent) {
        setMessages([...newMessages, { role: 'assistant', content: fullContent }]);
      }
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered a temporary connection glitch. Please try asking again! 🔄',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [message, token]);

  const handleSmartAction = (msg: string) => {
    handleSend(msg);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: '80px', right: '24px', zIndex: 999,
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', borderRadius: '50px', border: 'none',
            background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 25px rgba(226, 55, 68, 0.4)',
            cursor: 'pointer', fontFamily: '"Outfit", sans-serif',
            fontSize: '14px', fontWeight: 700,
            transition: 'transform 0.2s, box-shadow 0.2s',
            animation: 'pulseBtn 2.5s infinite',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
        >
          <span style={{ fontSize: '18px' }}>💬</span>
          <span>Ask Chef Katanguri</span>
        </button>
      )}

      {isOpen && (
        <div
          ref={chatRef}
          role="dialog"
          aria-label="AI Assistant Chat"
          style={{
            position: 'fixed', bottom: '80px', right: '24px', zIndex: 999,
            width: '380px', height: '560px',
            background: 'rgba(15, 15, 21, 0.92)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: '"Outfit", sans-serif',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(226, 55, 68, 0.15) 0%, rgba(0, 0, 0, 0) 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '24px' }}>👨‍🍳</span>
                <span style={{
                  position: 'absolute', bottom: '2px', right: '0px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: '#10b981', border: '1px solid #0f0f15',
                }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Chef Katanguri</div>
                <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>AI support active</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close chat"
              style={{
                background: 'none', border: 'none', color: '#a1a1aa', fontSize: '16px',
                cursor: 'pointer', width: 44, height: 44, minWidth: 44, minHeight: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#a1a1aa')}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div role="log" aria-live="polite" aria-label="Chat messages"
            style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '82%', padding: '10px 16px', fontSize: '13.5px', lineHeight: '1.55',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    textAlign: 'left', color: '#ffffff', whiteSpace: 'pre-wrap',
                    background: isUser
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'linear-gradient(135deg, rgba(226, 55, 68, 0.2) 0%, rgba(198, 40, 40, 0.2) 100%)',
                    border: isUser
                      ? '1px solid rgba(255, 255, 255, 0.05)'
                      : '1px solid rgba(226, 55, 68, 0.12)',
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div role="status" aria-label="Chef is typing..."
                  style={{
                    background: 'rgba(226, 55, 68, 0.15)', border: '1px solid rgba(226, 55, 68, 0.1)',
                    borderRadius: '16px 16px 16px 4px', padding: '12px 20px',
                    color: '#a1a1aa', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                  <span>Chef is typing</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0s' }}>•</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.2s' }}>•</span>
                  <span className="dot" style={{ animation: 'bounceDot 1.4s infinite', animationDelay: '0.4s' }}>•</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Smart Action Chips */}
          {showSmartActions && messages.length <= 1 && (
            <div style={{ padding: '0 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {SMART_ACTIONS.map((action) => (
                <button key={action.label} onClick={() => handleSmartAction(action.message)}
                  style={{
                    padding: '8px 10px', borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: '#d4d4d8', fontSize: '11px', cursor: 'pointer',
                    textAlign: 'left', lineHeight: '1.3',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(226, 55, 68, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(226, 55, 68, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  }}
                >
                  <span style={{ fontSize: '14px', display: 'block', marginBottom: 2 }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Follow-up chips (after first interaction) */}
          {showSmartActions && messages.length > 1 && (
            <div style={{
              padding: '0 16px 8px', display: 'flex', gap: '6px', overflowX: 'auto',
              scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              {[
                { label: 'Plan another meal 📋', token: '__MEAL_PLAN__' },
                { label: 'Tell me a food story 📖', token: '__FOOD_STORY__' },
                { label: 'Budget picks 💰', token: '__MEAL_PLAN_BUDGET__' },
                { label: 'What\'s good today? ✨', token: 'What do you recommend for me today?' },
              ].map((item) => (
                <button key={item.label} onClick={() => handleSmartAction(item.token)}
                  style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    background: 'rgba(255, 255, 255, 0.03)', color: '#d4d4d8',
                    fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: '14px 18px', borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', gap: '10px', background: 'rgba(0, 0, 0, 0.2)',
            }}>
            <input ref={inputRef} type="text" value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything about our food..."
              aria-label="Type your message"
              style={{
                flex: 1, background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px', padding: '10px 14px', color: '#ffffff',
                fontSize: '13px', outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(226, 55, 68, 0.4)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            <button type="submit"
              style={{
                background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
                color: '#ffffff', border: 'none', borderRadius: '12px',
                padding: '10px 18px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', transition: 'transform 0.1s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Send
            </button>
          </form>
        </div>
      )}

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
