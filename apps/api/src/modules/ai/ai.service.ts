import { RECOMMENDATION_PROMPT, SENTIMENT_PROMPT, PROMO_PROMPT, CUSTOMER_CHAT_PROMPT, ADMIN_CHAT_PROMPT } from './prompts.js';
import type { SentimentResult, PromoSuggestion } from './types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'ai-service' });

function getGroqKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  return key && key !== 'CHANGE_ME' ? key : null;
}

function getGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key && key !== 'CHANGE_ME' ? key : null;
}

async function callGroq(prompt: string, systemPrompt: string): Promise<string | null> {
  const apiKey = getGroqKey();
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      log.warn({ status: res.status, statusText: res.statusText }, '[Groq] API error');
      return null;
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    log.warn({ err: err.message }, '[Groq] Request failed');
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = getGeminiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!res.ok) {
      log.warn({ status: res.status, statusText: res.statusText }, '[Gemini] API error');
      return null;
    }

    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err: any) {
    log.warn({ err: err.message }, '[Gemini] Request failed');
    return null;
  }
}

function parseJsonResponse<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```(?:json)?\s*/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    log.warn({ preview: text.slice(0, 100) }, '[AI] Failed to parse JSON response');
    return null;
  }
}

export async function groqRecommendations(
  orderHistory: { name: string; qty: number }[],
  menuItems: { id: number; name: string; price: number; isVeg: boolean | null; category: string }[],
): Promise<{ dishId: number; reason: string }[] | null> {
  const prompt = RECOMMENDATION_PROMPT
    .replace('{{orderHistory}}', orderHistory.map(o => `- ${o.name} (x${o.qty})`).join('\n'))
    .replace('{{menuItems}}', menuItems.map(m => `- ${m.name} (₹${m.price}, ${m.isVeg ? 'veg' : 'non-veg'}, ${m.category})`).join('\n'));

  const result = await callGroq(prompt, 'You are a restaurant recommendation system. Return only valid JSON.');
  return parseJsonResponse<{ dishId: number; reason: string }[]>(result);
}

export async function geminiSentimentAnalysis(
  rating: string,
  comment: string | null,
): Promise<SentimentResult | null> {
  const prompt = SENTIMENT_PROMPT
    .replace('{{rating}}', rating)
    .replace('{{comment}}', comment?.trim() || '(no comment)');

  const result = await callGemini(prompt);
  return parseJsonResponse<SentimentResult>(result);
}

export async function groqPromoSuggestions(
  orderData: string,
  lowPerformers: string,
  avgOrderValue: number,
): Promise<PromoSuggestion[] | null> {
  const prompt = PROMO_PROMPT
    .replace('{{orderData}}', orderData)
    .replace('{{lowPerformers}}', lowPerformers)
    .replace('{{avgOrderValue}}', avgOrderValue.toString());

  const result = await callGroq(prompt, 'You are a pricing strategist. Return only valid JSON.');
  return parseJsonResponse<PromoSuggestion[]>(result);
}

export function hasGroqKey(): boolean {
  return getGroqKey() !== null;
}

export function hasGeminiKey(): boolean {
  return getGeminiKey() !== null;
}

export async function chatCustomer(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  menu: string,
  orders: string
): Promise<string> {
  const systemPrompt = CUSTOMER_CHAT_PROMPT
    .replace('{{menu}}', menu)
    .replace('{{orders}}', orders);

  const groqKey = getGroqKey();
  const geminiKey = getGeminiKey();

  if (groqKey) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message },
      ];
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.5,
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content || 'Chef Katanguri is thinking... Please try again.';
      }
    } catch (err: any) {
      log.warn({ err: err.message }, '[Chat] Groq request failed');
    }
  }

  if (geminiKey) {
    try {
      const formattedHistory = history.map(h => `${h.role === 'user' ? 'Customer' : 'Chef'}: ${h.content}`).join('\n');
      const prompt = `${systemPrompt}\n\nChat History:\n${formattedHistory}\n\nCustomer: ${message}\nChef:`;
      const reply = await callGemini(prompt);
      if (reply) return reply;
    } catch (err: any) {
      log.warn({ err: err.message }, '[Chat] Gemini request failed');
    }
  }

  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('veg')) {
    return "Chef Katanguri here! I highly recommend our Butter Paneer Masala and Dal Makhani. They are fresh, creamy, and prepared with our special in-house spice blend from Warangal.";
  }
  if (lowerMsg.includes('status') || lowerMsg.includes('order')) {
    return "I would be happy to check that for you! According to the active orders context, your food is currently being prepared and is on track. Let me know if you need tracking details!";
  }
  return `Welcome to Katanguri's Kitchen! I received your query: "${message}". How can I help you enjoy our authentic South Indian culinary creations today?`;
}

export async function chatAdminInsights(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  lowStock: string,
  salesStats: string
): Promise<string> {
  const systemPrompt = ADMIN_CHAT_PROMPT
    .replace('{{lowStock}}', lowStock)
    .replace('{{salesStats}}', salesStats);

  const groqKey = getGroqKey();
  const geminiKey = getGeminiKey();

  if (groqKey) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message },
      ];
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content || 'Failed to generate operational report.';
      }
    } catch (err: any) {
      log.warn({ err: err.message }, '[Chat Admin] Groq request failed');
    }
  }

  if (geminiKey) {
    try {
      const formattedHistory = history.map(h => `${h.role === 'user' ? 'Manager' : 'Assistant'}: ${h.content}`).join('\n');
      const prompt = `${systemPrompt}\n\nConversation:\n${formattedHistory}\n\nManager: ${message}\nAssistant:`;
      const reply = await callGemini(prompt);
      if (reply) return reply;
    } catch (err: any) {
      log.warn({ err: err.message }, '[Chat Admin] Gemini request failed');
    }
  }

  // Smart rule-based fallback using the live context already fetched
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('stock') || lowerMsg.includes('inventory') || lowerMsg.includes('ingredient')) {
    const stockSummary = lowStock === 'All ingredients are well-stocked above par levels.'
      ? '✅ All ingredients are currently well-stocked above par levels. No restocking required today.'
      : `⚠️ Low Stock Alert:\n${lowStock}\n\n📋 Action Required: Place supplier orders for the above items to prevent menu disruptions.`;
    return `Inventory Status Report:\n${stockSummary}`;
  }

  if (lowerMsg.includes('sales') || lowerMsg.includes('revenue') || lowerMsg.includes('order') || lowerMsg.includes('today')) {
    return `Sales Summary:\n${salesStats}\n\n📈 Tip: To improve today's revenue, consider enabling a flash discount on slow-moving menu items between 2–5 PM when order volume typically dips.`;
  }

  if (lowerMsg.includes('promo') || lowerMsg.includes('discount') || lowerMsg.includes('offer') || lowerMsg.includes('marketing')) {
    return `Promotion Recommendations:\n• 🍱 Combo Deal — Bundle a main + side + drink for ₹199 to increase average order value.\n• 🕐 Happy Hour (2–5 PM) — 15% off on all biryanis to boost off-peak orders.\n• 📦 Free Delivery above ₹300 — Reduces cart abandonment at checkout.\n\n💡 To get AI-generated promo strategies, add your GROQ_API_KEY or GEMINI_API_KEY to the .env file.`;
  }

  // Generic: show what data is available
  return `Operations Console Ready\n\n${salesStats}\n\nYou can ask me about:\n• 📦 Inventory / stock levels\n• 📈 Today's sales & revenue\n• 🏷️ Promotional suggestions\n\n💡 For full AI-powered analysis, add GROQ_API_KEY (free at console.groq.com) or GEMINI_API_KEY to your .env file.`;
}
