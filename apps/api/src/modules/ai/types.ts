export interface AiConfig {
  groqKey: string;
  geminiKey: string;
}

export interface AiRecommendation {
  dishId: number;
  dishName: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  categoryName: string;
  score: number;
  reason: string;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  themes: string[];
  summary: string;
  suggestedAction?: string;
}

export interface PromoSuggestion {
  type: 'percentage' | 'flat';
  value: number;
  minOrderAmount: number;
  reason: string;
  targetDishes?: { dishId: number; name: string }[];
  expectedImpact: string;
}

export interface FeedbackAnalysis {
  feedbackId: number;
  sentiment: string;
  themes: string[];
  summary: string;
  suggestedAction: string | null;
  analyzedAt: Date;
}

export interface AiInsight {
  type: 'underperforming_dish' | 'peak_hour' | 'bundle_opportunity' | 'inventory_risk';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestion?: string;
}
