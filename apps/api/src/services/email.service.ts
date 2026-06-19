import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'The Katanguri\'s Kitchen <onboarding@resend.dev>';
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || '';
const APP_NAME = 'The Katanguri\'s Kitchen';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

if (resend) {
  logger.info('[EMAIL] Resend initialized');
} else {
  logger.warn('[EMAIL] RESEND_API_KEY not set — emails will not be sent');
}

function baseTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#e23744,#c62828);padding:24px 32px;text-align:center;">
      <img src="${APP_URL}/logo.avif" alt="${APP_NAME}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.4);margin-bottom:12px;" />
      <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">${APP_NAME}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1c1c1c;font-size:20px;margin:0 0 16px;">${title}</h2>
      ${content}
    </div>
    <div style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p style="color:#999;font-size:11px;margin:4px 0 0;">
        <a href="${APP_URL}/account" style="color:#e23744;text-decoration:none;">Manage Preferences</a> ·
        <a href="${APP_URL}/account" style="color:#999;text-decoration:none;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function send(options: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    logger.warn({ to: options.to, subject: options.subject }, '[EMAIL] Skipped — no provider configured');
    return false;
  }

  try {
    const payload: any = {
      from: FROM_EMAIL,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    };
    if (REPLY_TO_EMAIL) payload.reply_to = REPLY_TO_EMAIL;

    const { error } = await resend.emails.send(payload);
    if (error) {
      logger.error({ err: error, to: options.to }, '[EMAIL] Resend error');
      return false;
    }
    logger.info({ to: options.to, subject: options.subject }, '[EMAIL] Sent via Resend');
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, to: options.to }, '[EMAIL] Failed');
    return false;
  }
}

// ── OTP Email ──
export async function sendOTP(email: string, otp: string, purpose: string = 'verification'): Promise<boolean> {
  const html = baseTemplate('Your Verification Code', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Use the code below to complete your ${purpose}.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:#f8f8f8;border:2px dashed #e23744;border-radius:12px;padding:20px 40px;">
        <div style="font-size:36px;font-weight:800;color:#1c1c1c;letter-spacing:8px;font-family:monospace;">${otp}</div>
      </div>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">This code expires in 10 minutes. Do not share it with anyone.</p>
  `);

  return send({ to: email, subject: `Your ${purpose} Code — ${APP_NAME}`, html });
}

// ── Order Confirmation ──
export async function sendOrderConfirmation(email: string, orderId: number, items: { name: string; qty: number; price: number }[], totalAmount: number): Promise<boolean> {
  const itemRows = items.map(i =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;">${escapeHtml(i.name)}</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:center;color:#666;">x${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">₹${i.price * i.qty}</td></tr>`
  ).join('');

  const html = baseTemplate('Order Confirmed!', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Thank you for your order! We've received it and our kitchen is getting started.</p>
    <div style="background:#f8f8f8;border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="font-size:14px;color:#999;margin-bottom:4px;">Order #${orderId}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:2px solid #1c1c1c;"><th style="padding:8px 0;text-align:left;font-size:13px;color:#999;">Item</th><th style="padding:8px 0;text-align:center;font-size:13px;color:#999;">Qty</th><th style="padding:8px 0;text-align:right;font-size:13px;color:#999;">Price</th></tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot><tr style="border-top:2px solid #1c1c1c;"><td colspan="2" style="padding:12px 0;font-weight:700;font-size:16px;">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px;color:#e23744;">₹${totalAmount}</td></tr></tfoot>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${APP_URL}/track?id=${orderId}" style="display:inline-block;background:#e23744;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Track Your Order</a>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">Estimated delivery: 30 minutes</p>
  `);

  return send({ to: email, subject: `Order #${orderId} Confirmed — ${APP_NAME}`, html });
}

// ── Out for Delivery ──
export async function sendOutForDelivery(email: string, orderId: number): Promise<boolean> {
  const html = baseTemplate('Your Order is On the Way!', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Great news! Your order has left the kitchen and is heading your way.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/track?id=${orderId}" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Track Live</a>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">Your delivery partner will reach you shortly.</p>
  `);

  return send({ to: email, subject: `Order #${orderId} Out for Delivery — ${APP_NAME}`, html });
}

// ── Feedback Request ──
export async function sendFeedbackRequest(email: string, orderId: number): Promise<boolean> {
  const html = baseTemplate('How Was Your Meal?', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">We hope you enjoyed your food! Your feedback helps us serve you better.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/feedback/${orderId}" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Rate Your Experience</a>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">It takes just 30 seconds and means the world to us.</p>
  `);

  return send({ to: email, subject: `How was Order #${orderId}? — ${APP_NAME}`, html });
}

// ── Abandoned Cart ──
export async function sendAbandonedCart(email: string, cartSummary: string): Promise<boolean> {
  const html = baseTemplate('You Left Items in Your Cart!', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Don't miss out! Your favorites are waiting. Complete your order now and get <strong style="color:#e23744;">10% OFF</strong>.</p>
    <div style="background:#fff5f5;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;">
      <div style="font-size:14px;color:#666;margin-bottom:8px;">${escapeHtml(cartSummary)}</div>
      <div style="font-size:24px;font-weight:700;color:#e23744;">10% OFF</div>
      <div style="font-size:12px;color:#999;margin-top:4px;">Use code: COMEBACK10</div>
    </div>
    <div style="text-align:center;">
      <a href="${APP_URL}/cart" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Complete Order</a>
    </div>
  `);

  return send({ to: email, subject: `Complete Your Order — 10% Off — ${APP_NAME}`, html });
}

// ── Re-engagement ──
export async function sendReEngagement(email: string, name: string): Promise<boolean> {
  const html = baseTemplate(`We Miss You, ${escapeHtml(name)}!`, `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">It's been a while since your last order. We've got something special for you — <strong style="color:#e23744;">15% OFF</strong> your next order!</p>
    <div style="background:#fff5f5;border-radius:10px;padding:24px;margin-bottom:20px;text-align:center;">
      <div style="font-size:14px;color:#999;margin-bottom:8px;">Your exclusive code</div>
      <div style="font-size:28px;font-weight:700;color:#e23744;letter-spacing:2px;">WELCOME15</div>
      <div style="font-size:12px;color:#999;margin-top:4px;">Valid for 7 days</div>
    </div>
    <div style="text-align:center;">
      <a href="${APP_URL}/menu" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Order Now</a>
    </div>
  `);

  return send({ to: email, subject: `15% Off — We Miss You! — ${APP_NAME}`, html });
}

// ── Admin Alert ──
export async function sendAdminAlert(emails: string[], subject: string, body: string): Promise<boolean> {
  const html = baseTemplate('System Alert', `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;margin-bottom:16px;">
      <pre style="margin:0;font-family:monospace;font-size:13px;color:#92400e;white-space:pre-wrap;">${escapeHtml(body)}</pre>
    </div>
    <p style="color:#999;font-size:12px;">This is an automated alert from the kitchen management system.</p>
  `);

  let allSuccess = true;
  for (const email of emails) {
    const ok = await send({ to: email, subject: `[ALERT] ${subject}`, html });
    if (!ok) allSuccess = false;
  }
  return allSuccess;
}

// ── Contact Form Email ──
export async function sendContactForm(name: string, email: string, subject: string, message: string): Promise<boolean> {
  const adminEmail = process.env.CONTACT_FORM_EMAIL || process.env.ADMIN_EMAIL || 'admin@thekatanguriskitchen.com';
  const html = baseTemplate('New Contact Form Submission', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">You have received a new contact form submission.</p>
    <div style="background:#f8f8f8;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="color:#1c1c1c;font-size:14px;margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p style="color:#1c1c1c;font-size:14px;margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="color:#1c1c1c;font-size:14px;margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(subject) || 'No subject'}</p>
      <p style="color:#1c1c1c;font-size:14px;margin:0;"><strong>Message:</strong></p>
      <p style="color:#666;font-size:14px;line-height:1.6;margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `);

  return send({ to: adminEmail, subject: `Contact Form: ${escapeHtml(subject) || 'No subject'} — ${APP_NAME}`, html });
}
