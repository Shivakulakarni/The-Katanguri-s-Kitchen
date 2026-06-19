import { sendAdminAlert } from '../../services/email.service.js';
import { sendSMS as sendSMSService } from '../../services/sms.service.js';
import { logger } from '../../utils/logger.js';

export interface NotificationConfig {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromAddress: string;
    toAddresses: string[];
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
  };
  sms: {
    enabled: boolean;
    provider: string; // 'twilio' | 'textlocal' | 'custom'
    apiKey: string;
    apiSecret: string;
    fromNumber: string;
    toNumbers: string[];
  };
}

interface AlertPayload {
  source: string;
  errorRate: number;
  failedCount: number;
  totalCount: number;
  windowMinutes: number;
  thresholdPercent: number;
  timestamp: string;
}

// Get notification config from environment or defaults
function getConfig(): NotificationConfig {
  return {
    email: {
      enabled: !!process.env.ALERT_EMAIL_TO,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      fromAddress: process.env.ALERT_EMAIL_FROM || 'alerts@thekatanguriskitchen.com',
      toAddresses: (process.env.ALERT_EMAIL_TO || '').split(',').filter(Boolean),
    },
    slack: {
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_CHANNEL || '#kitchen-alerts',
    },
    sms: {
      enabled: !!process.env.SMS_TO_NUMBERS,
      provider: process.env.SMS_PROVIDER || 'twilio',
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET || '',
      fromNumber: process.env.SMS_FROM || '+919876543210',
      toNumbers: (process.env.SMS_TO_NUMBERS || '').split(',').filter(Boolean),
    },
  };
}

// Build alert message text
function buildAlertMessage(alert: AlertPayload): { subject: string; body: string; slackText: string } {
  const sourceLabel = alert.source === 'all' ? 'ALL PLATFORMS' : alert.source.toUpperCase();
  const severity = alert.errorRate >= 20 ? '🔴 CRITICAL' : alert.errorRate >= 10 ? '🟡 WARNING' : '🟠 DEGRADED';

  const subject = `${severity} Webhook Alert: ${sourceLabel} - ${alert.errorRate}% error rate`;
  const body = [
    `🚨 WEBHOOK ALERT - The Katanguri's Kitchen`,
    ``,
    `Source: ${sourceLabel}`,
    `Severity: ${severity}`,
    `Error Rate: ${alert.errorRate}%`,
    `Failed: ${alert.failedCount}/${alert.totalCount} orders`,
    `Window: Last ${alert.windowMinutes} minutes`,
    `Threshold: >${alert.thresholdPercent}%`,
    `Time: ${new Date(alert.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ``,
    `Action Required: Check webhook health at ${process.env.APP_URL || 'https://the-katanguris-kitchen.vercel.app'}/webhooks/health`,
  ].join('\n');

  const slackText = [
    `${severity} *Webhook Alert*`,
    `> *Source:* ${sourceLabel}`,
    `> *Error Rate:* ${alert.errorRate}% (${alert.failedCount}/${alert.totalCount} failed)`,
    `> *Window:* Last ${alert.windowMinutes} min`,
    `> *Threshold:* >${alert.thresholdPercent}%`,
    `<${process.env.APP_URL || 'https://the-katanguris-kitchen.vercel.app'}/webhooks/health|View Webhook Health>`,
  ].join('\n');

  return { subject, body, slackText };
}

// Send email notification via SendGrid
async function sendEmail(config: NotificationConfig['email'], subject: string, body: string): Promise<boolean> {
  if (!config.enabled) return false;

  try {
    return await sendAdminAlert(config.toAddresses, subject, body);
  } catch (err: any) {
    logger.error({ err: err.message }, '[EMAIL ALERT] Failed');
    return false;
  }
}

// Send Slack notification via incoming webhook
async function sendSlack(config: NotificationConfig['slack'], text: string): Promise<boolean> {
  if (!config.enabled || !config.webhookUrl) return false;

  try {
    if (config.webhookUrl.startsWith('https://hooks.slack.com/')) {
      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: config.channel, text, username: 'Kitchen Alerts', icon_emoji: ':kitchen:' }),
      });
      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
      logger.info({ channel: config.channel }, '[SLACK ALERT] Sent');
    } else {
      logger.info({ channel: config.channel, text }, '[SLACK ALERT] Console mode');
    }
    return true;
  } catch (err: any) {
    logger.error({ err: err.message }, '[SLACK ALERT] Failed');
    return false;
  }
}

// Send SMS notification via shared SMS service
async function sendSMSNotification(config: NotificationConfig['sms'], message: string): Promise<boolean> {
  if (!config.enabled) return false;

  let allSuccess = true;
  for (const to of config.toNumbers) {
    const ok = await sendSMSService(to, message);
    if (!ok) allSuccess = false;
  }
  return allSuccess;
}

// Main notification dispatcher
export async function sendWebhookAlertNotification(alert: AlertPayload): Promise<{ email: boolean; slack: boolean; sms: boolean }> {
  const config = getConfig();
  const { subject, body, slackText } = buildAlertMessage(alert);

  const results = { email: false, slack: false, sms: false };

  // Send to all enabled channels in parallel
  const [emailResult, slackResult, smsResult] = await Promise.allSettled([
    sendEmail(config.email, subject, body),
    sendSlack(config.slack, slackText),
    sendSMSNotification(config.sms, body),
  ]);

  results.email = emailResult.status === 'fulfilled' ? emailResult.value : false;
  results.slack = slackResult.status === 'fulfilled' ? slackResult.value : false;
  results.sms = smsResult.status === 'fulfilled' ? smsResult.value : false;

  logger.info({ email: results.email, slack: results.slack, sms: results.sms }, '[ALERT DISPATCH]');

  return results;
}
