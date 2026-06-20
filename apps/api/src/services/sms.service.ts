import twilio from 'twilio';
import { logger } from '../utils/logger.js';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

const isPlaceholder = (v: string) => !v || v.includes('CHANGE_ME') || v.includes('YOUR_PROJECT') || v === 'null';

const hasRealCreds = !isPlaceholder(TWILIO_ACCOUNT_SID) && !isPlaceholder(TWILIO_AUTH_TOKEN) && !isPlaceholder(TWILIO_PHONE_NUMBER);
const isTwilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER && hasRealCreds);

let twilioClient: twilio.Twilio | null = null;
if (isTwilioConfigured) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    logger.info('[SMS] Twilio client initialized');
  } catch (err: any) {
    logger.error({ err: err.message }, '[SMS] Failed to initialize Twilio client');
    twilioClient = null;
  }
} else {
  logger.warn('[SMS] Twilio not configured — SMS delivery will fail in production');
}

export interface SmsResult {
  success: boolean;
  error?: string;
  provider?: string;
  sid?: string;
}

export async function sendSMS(
  to: string,
  message: string,
  options?: { from?: string }
): Promise<SmsResult> {
  if (!to || to.length < 10) {
    return { success: false, error: 'Invalid phone number' };
  }

  const recipient = to.startsWith('+') ? to : `+91${to.replace(/^0+/, '')}`;

  if (!isTwilioConfigured || !twilioClient) {
    logger.warn({ to: recipient }, '[SMS] Twilio not configured — OTP NOT delivered');
    return { success: false, error: 'SMS service not configured. Please use email OTP.', provider: 'console' };
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: options?.from || TWILIO_PHONE_NUMBER,
      to: recipient,
    });
    logger.info({ to: recipient, sid: result.sid }, '[SMS] Sent successfully');
    return { success: true, provider: 'twilio', sid: result.sid };
  } catch (err: any) {
    logger.error({ err: err.message, to: recipient, code: err.code }, '[SMS] Failed to send');
    return { success: false, error: err.message || 'SMS delivery failed', provider: 'twilio' };
  }
}

export async function sendOrderSMS(phone: string, template: 'confirmation' | 'out_for_delivery' | 'feedback' | 'abandoned_cart', data: Record<string, any>): Promise<SmsResult> {
  const appUrl = process.env.APP_URL || 'https://the-katanguris-kitchen.vercel.app';
  const templates: Record<string, (d: Record<string, any>) => string> = {
    confirmation: (d) => `Order #${d.orderId} confirmed! Your food is being prepared. ETA: 30 min — The Katanguri's Kitchen`,
    out_for_delivery: (d) => `Your order #${d.orderId} is out for delivery! Track live: ${appUrl}/track/${d.orderId}`,
    feedback: (d) => `How was your meal? Rate your experience: ${appUrl}/track/${d.orderId}`,
    abandoned_cart: (_d) => `You left items in your cart! Complete your order and get 10% off: ${appUrl}/cart`,
  };

  const message = templates[template]?.(data);
  if (!message) return { success: false, error: 'Unknown template' };
  return sendSMS(phone, message);
}

export { isTwilioConfigured };
