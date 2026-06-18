import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { feedbacks } from './feedback';

export const feedbackAnalysis = pgTable('feedback_analysis', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  feedbackId: integer('feedback_id').notNull().references(() => feedbacks.id).unique(),
  sentiment: text('sentiment').notNull(),
  score: text('score').notNull(),
  themes: text('themes').notNull(),
  summary: text('summary'),
  suggestedAction: text('suggested_action'),
  analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
});
