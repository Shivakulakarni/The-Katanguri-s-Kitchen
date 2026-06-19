import { RECOMMENDATION_PROMPT, SENTIMENT_PROMPT, PROMO_PROMPT, CUSTOMER_CHAT_PROMPT, ADMIN_CHAT_PROMPT, MEAL_PLANNER_PROMPT, FOOD_STORY_PROMPT } from './prompts.js';
import type { SentimentResult, PromoSuggestion, MealPlan } from './types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'ai-service' });

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'afternoon';
  if (hour >= 15 && hour < 18) return 'evening';
  return 'night';
}

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

async function callGroqStream(
  messages: { role: string; content: string }[],
  onChunk: (chunk: string) => void,
): Promise<string | null> {
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
        messages,
        temperature: 0.5,
        max_tokens: 800,
        stream: true,
      }),
    });

    if (!res.ok) return null;
    if (!res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let streamDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (streamDone) break;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch { /* skip malformed lines */ }
        }
      }
      if (streamDone) break;
    }

    return fullText || null;
  } catch (err: any) {
    log.warn({ err: err.message }, '[Groq] Stream request failed');
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

export async function enhanceRecommendations(
  localRecs: { dishId: number; dishName: string; reason: string; score: number }[],
  orderHistory: string,
): Promise<{ dishId: number; reason: string }[] | null> {
  if (!getGroqKey()) return null;
  const dishList = localRecs.map(r => `- ${r.dishName} (ID: ${r.dishId}, Score: ${r.score}, Reason: ${r.reason})`).join('\n');
  const prompt = `You are a restaurant recommendation curator for "Katanguri's Kitchen" in Warangal, India.

The local algorithm ranked these dishes for a customer:
${dishList}

Customer's recent orders:
${orderHistory || 'No previous orders'}

Re-rank the top 5 dishes. Consider:
- Variety (don't pick all from same category)
- Price range consistency with customer's history
- Seasonal/timing appropriateness
- Avoid recommending dishes too similar to recent orders

Return ONLY a JSON array of the top 5 dishIds with improved reasons:
[{ "dishId": number, "reason": "personalized reason (max 15 words)" }]`;

  const result = await callGroq(prompt, 'You are a food curator. Return only valid JSON.');
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
  orders: string,
  dietaryProfile: string = 'No restrictions specified',
): Promise<string> {
  const timeOfDay = getTimeOfDay();
  const systemPrompt = CUSTOMER_CHAT_PROMPT
    .replace('{{menu}}', menu)
    .replace('{{orders}}', orders)
    .replace('{{timeOfDay}}', timeOfDay)
    .replace('{{dietaryProfile}}', dietaryProfile);

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

export async function generateMealPlan(
  mealType: string,
  menu: string,
  budget: number = 300,
  dietary: string = 'No restrictions',
  favorites: string = '',
): Promise<MealPlan | null> {
  const prompt = MEAL_PLANNER_PROMPT
    .replace('{{mealType}}', mealType)
    .replace('{{budget}}', `₹${budget}`)
    .replace('{{dietary}}', dietary)
    .replace('{{preferences}}', favorites || 'No preferences set')
    .replace('{{menu}}', menu);

  const result = await callGroq(prompt, 'You are a meal planning expert. Return only valid JSON.');
  const parsed = parseJsonResponse<MealPlan>(result);

  // Fallback: rule-based meal plan if LLM fails
  if (!parsed) {
    return generateFallbackMealPlan(mealType, budget);
  }
  return parsed;
}

function generateFallbackMealPlan(mealType: string, budget: number): MealPlan {
  const meals: Record<string, { name: string; price: number; reason: string }[]> = {
    breakfast: [
      { name: 'Masala Dosa', price: 80, reason: 'Classic South Indian breakfast, crispy and flavorful' },
      { name: 'Idli Sambar', price: 60, reason: 'Light, healthy, and perfectly steamed' },
      { name: 'Chai', price: 20, reason: 'Perfect pairing to start your morning' },
    ],
    lunch: [
      { name: 'Chicken Biryani', price: 180, reason: 'Hearty, aromatic, and filling' },
      { name: 'Dal Makhani', price: 120, reason: 'Creamy lentils that complement biryani perfectly' },
      { name: 'Raita', price: 30, reason: 'Cool and refreshing side' },
    ],
    dinner: [
      { name: 'Butter Paneer Masala', price: 150, reason: 'Rich and comforting for evening dining' },
      { name: 'Naan', price: 40, reason: 'Soft bread to soak up the gravy' },
      { name: 'Gulab Jamun', price: 50, reason: 'Sweet ending to your meal' },
    ],
    snack: [
      { name: 'Samosa', price: 40, reason: 'Crispy, golden, and perfectly spiced' },
      { name: 'Pakoda', price: 50, reason: 'Crunchy tea-time favorite' },
      { name: 'Chai', price: 20, reason: 'The perfect chai-time companion' },
    ],
  };

  const items = meals[mealType] || meals.lunch;
  const withinBudget = items.filter(item => item.price <= budget);
  const selected = withinBudget.length >= 2 ? withinBudget.slice(0, 3) : items.slice(0, 2);

  return {
    mealType,
    totalPrice: selected.reduce((sum, item) => sum + item.price, 0),
    dishes: selected.map((item, i) => ({ id: i + 1, ...item })),
    pairingNote: 'These dishes complement each other in flavors and textures for a satisfying meal.',
    chefTip: mealType === 'lunch'
      ? 'Enjoy your biryani with a side of mirchi ka salan for an authentic Hyderabadi experience!'
      : mealType === 'snack'
      ? 'Best enjoyed hot with a cup of our special Warangal chai!'
      : 'Take your time to savor each bite — good food is meant to be enjoyed slowly.',
  };
}

export async function generateFoodStory(
  dishName: string,
  category: string,
  price: number,
  description: string,
  isVeg: boolean,
): Promise<string | null> {
  const prompt = FOOD_STORY_PROMPT
    .replace(/{{dishName}}/g, dishName)
    .replace('{{category}}', category)
    .replace('{{price}}', `₹${price}`)
    .replace('{{description}}', description || 'A signature dish')
    .replace('{{isVeg}}', isVeg ? 'Yes' : 'No');

  const result = await callGroq(prompt, 'You are Chef Katanguri, a passionate chef. Tell an engaging food story.');

  if (!result) {
    if (isVeg) {
      return `Our ${dishName} is a celebration of vegetarian cuisine from the heart of Warangal. Each ingredient is handpicked from local markets — the fresh vegetables from our trusted farmers, the spices ground in-house using a blend that's been in Chef Katanguri's family for three generations. The cooking technique follows the traditional Telangana style, where patience and love are the most important ingredients. Every bite tells the story of our land's rich culinary heritage.`;
    }
    return `The ${dishName} is one of Chef Katanguri's proudest creations, inspired by the vibrant food culture of Warangal. We source the finest cuts, marinate them for hours in a secret spice blend that includes hand-roasted masalas, and cook them using time-honored techniques passed down through generations. The result is a dish that's tender, flavorful, and unmistakably authentic — just like you'd find in the best homes of Telangana.`;
  }
  return result;
}

export async function chatCustomerStream(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  menu: string,
  orders: string,
  dietaryProfile: string = 'No restrictions specified',
  onChunk: (chunk: string) => void,
): Promise<string | null> {
  const timeOfDay = getTimeOfDay();
  const systemPrompt = CUSTOMER_CHAT_PROMPT
    .replace('{{menu}}', menu)
    .replace('{{orders}}', orders)
    .replace('{{timeOfDay}}', timeOfDay)
    .replace('{{dietaryProfile}}', dietaryProfile);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  return callGroqStream(messages, onChunk);
}
