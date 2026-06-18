import { pgTable, integer, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  action: text('action').notNull(),
  userId: integer('user_id'),
  userRole: text('user_role').default('system'),
  changes: jsonb('changes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
  userIdx: index('idx_audit_logs_user').on(table.userId),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
}));
