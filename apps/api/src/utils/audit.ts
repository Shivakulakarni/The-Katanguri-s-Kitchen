import { db } from '../db/connection.js';
import { auditLogs } from '../db/schemas/audit.js';
import { logger } from './logger.js';

export interface AuditContext {
  userId?: number;
  userRole?: string;
}

interface AuditLogParams {
  entityType: string;
  entityId: number;
  action: 'create' | 'update' | 'delete';
  changes?: Record<string, { before: any; after: any } | any>;
  metadata?: Record<string, any>;
  ctx?: AuditContext;
}

/**
 * Write an audit log entry. Non-fatal — never throws.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.ctx?.userId ?? null,
      userRole: params.ctx?.userRole ?? 'system',
      changes: params.changes ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err: any) {
    logger.warn({ err: err.message, entityType: params.entityType, entityId: params.entityId }, '[Audit] Failed to write audit log');
  }
}

/**
 * Build a changes object from two records, only including fields that actually changed.
 */
export function diffChanges<T extends Record<string, any>>(
  before: T,
  after: T,
  fields?: string[],
): Record<string, { before: any; after: any }> {
  const keys = fields ?? Object.keys(before);
  const changes: Record<string, { before: any; after: any }> = {};
  for (const key of keys) {
    const bVal = before[key];
    const aVal = after[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changes[key] = { before: bVal, after: aVal };
    }
  }
  return changes;
}
