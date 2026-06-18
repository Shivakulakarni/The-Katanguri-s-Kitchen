import { pgTable, text, integer, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';

export const automationRules = pgTable('automation_rules', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  name: text('name').notNull(),
  trigger: text('trigger').notNull(),
  conditions: jsonb('conditions').notNull().default([]),
  actions: jsonb('actions').notNull().default([]),
  isActive: boolean('is_active').default(true),
  version: integer('version').default(1),
  lastTriggeredAt: timestamp('last_triggered_at'),
  executionCount: integer('execution_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  triggerIdx: index('idx_automation_rules_trigger').on(table.trigger),
  activeIdx: index('idx_automation_rules_active').on(table.isActive),
}));

export const automationLogs = pgTable('automation_logs', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  ruleId: integer('rule_id'),
  workflowName: text('workflow_name').notNull(),
  eventId: text('event_id'),
  action: text('action').notNull(),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  ruleIdx: index('idx_automation_logs_rule').on(table.ruleId),
  workflowIdx: index('idx_automation_logs_workflow').on(table.workflowName),
  statusIdx: index('idx_automation_logs_status').on(table.status),
  createdAtIdx: index('idx_automation_logs_created_at').on(table.createdAt),
}));
