import { db } from '../../db/connection.js';
import { automationRules } from '../../db/schemas/automation.js';
import { automationLogs } from '../../db/schemas/automation.js';
import { pubSub } from '../../utils/redis.js';
import { buildEventChannel } from '../../utils/eventBus.js';
import { RuleCondition, RuleAction } from '../../types/index.js';
import { eq } from 'drizzle-orm';

function evaluateCondition(condition: RuleCondition, context: Record<string, unknown>): boolean {
  const fieldValue = resolveField(condition.field, context);
  switch (condition.op) {
    case 'eq': return fieldValue === condition.value;
    case 'neq': return fieldValue !== condition.value;
    case 'lt': return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
    case 'lte': return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue <= condition.value;
    case 'gt': return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
    case 'gte': return typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue >= condition.value;
    case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'contains': return typeof fieldValue === 'string' && typeof condition.value === 'string' && fieldValue.includes(condition.value);
    default: return true;
  }
}

function resolveField(field: string, context: Record<string, unknown>): unknown {
  const parts = field.split('.');
  let value: any = context;
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return undefined;
    value = value[part];
  }
  return value;
}

async function executeAction(action: RuleAction, context: Record<string, unknown>): Promise<void> {
  const startTime = Date.now();
  try {
    switch (action.type) {
      case 'refund': {
        await pubSub.publish(buildEventChannel('action.refund'), JSON.stringify({
          paymentIntentId: context.paymentIntentId,
          full: action.params.full,
          orderId: context.orderId,
        }));
        break;
      }
      case 'notification': {
        const channel = action.params.channel as string;
        await pubSub.publish(buildEventChannel('action.notification'), JSON.stringify({
          channel,
          template: action.params.template,
          recipient: context.customerId,
          orderId: context.orderId,
        }));
        break;
      }
      case 'inventory_deduct': {
        await pubSub.publish(buildEventChannel('action.inventory_deduct'), JSON.stringify({
          orderId: context.orderId,
          items: context.items,
        }));
        break;
      }
      case 'dispatch_assign': {
        await pubSub.publish(buildEventChannel('action.dispatch_assign'), JSON.stringify({
          orderId: context.orderId,
        }));
        break;
      }
    }
    await logAutomation(action.type, context, 'success', Date.now() - startTime, null);
  } catch (err: any) {
    await logAutomation(action.type, context, 'failed', Date.now() - startTime, err.message);
    throw err;
  }
}

async function logAutomation(action: string, context: Record<string, unknown>, status: string, durationMs: number, errorMessage: string | null) {
  try {
    await db.insert(automationLogs).values({
      workflowName: `rule_${action}`,
      eventId: context.eventId as string,
      action,
      status,
      durationMs,
      errorMessage,
      payload: context,
    });
  } catch {
    // Logging failure should not break the main flow
  }
}

export async function evaluateRules(event: string, context: Record<string, unknown>): Promise<void> {
  const rules = await db.select().from(automationRules).where(eq(automationRules.isActive, true));
  const matchingRules = rules.filter(r => r.trigger === event);

  for (const rule of matchingRules) {
    const conditions = rule.conditions as RuleCondition[];
    const allMatch = conditions.every(c => evaluateCondition(c, context));
    if (!allMatch) continue;

    const actions = rule.actions as RuleAction[];
    for (const action of actions) {
      await executeAction(action, { ...context, ruleId: rule.id });
    }
  }
}


