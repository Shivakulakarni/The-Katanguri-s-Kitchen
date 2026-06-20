import { logger } from '../utils/logger.js';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const APP_NAME = 'The Katanguri\'s Kitchen';
const APP_URL = process.env.APP_URL || 'https://the-katanguris-kitchen.vercel.app';

function getFromEmail(): string {
  return process.env.SENDGRID_FROM_EMAIL || 'orders@thekatanguriskitchen.com';
}

async function sendGridSend(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY || '';
  if (!apiKey) {
    logger.warn('[EMAIL] SENDGRID_API_KEY not set — emails will not be sent');
    return false;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: getFromEmail(), name: APP_NAME },
        subject,
        content: [
          { type: 'text/html', value: html },
          ...(text ? [{ type: 'text/plain', value: text }] : []),
        ],
      }),
    });

    if (res.ok) {
      logger.info({ to, subject }, '[EMAIL] Sent via SendGrid');
      return true;
    }

    const body = await res.text();
    logger.error({ to, subject, status: res.status, body }, '[EMAIL] SendGrid error');
    return false;
  } catch (err: any) {
    logger.error({ err: err.message, to, subject }, '[EMAIL] SendGrid failed');
    return false;
  }
}

function baseTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#e23744,#c62828);padding:24px 32px;text-align:center;">
      <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">${APP_NAME}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1c1c1c;font-size:20px;margin:0 0 16px;">${title}</h2>
      ${content}
    </div>
    <div style="background:#f8f8f8;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

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

  return sendGridSend(email, `Your ${purpose} Code — ${APP_NAME}`, html);
}

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

  return sendGridSend(email, `Order #${orderId} Confirmed — ${APP_NAME}`, html);
}

export async function sendOutForDelivery(email: string, orderId: number): Promise<boolean> {
  const html = baseTemplate('Your Order is On the Way!', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Great news! Your order has left the kitchen and is heading your way.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/track?id=${orderId}" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Track Live</a>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">Your delivery partner will reach you shortly.</p>
  `);

  return sendGridSend(email, `Order #${orderId} Out for Delivery — ${APP_NAME}`, html);
}

export async function sendFeedbackRequest(email: string, orderId: number): Promise<boolean> {
  const html = baseTemplate('How Was Your Meal?', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">We hope you enjoyed your food! Your feedback helps us serve you better.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/feedback/${orderId}" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Rate Your Experience</a>
    </div>
    <p style="color:#999;font-size:13px;text-align:center;">It takes just 30 seconds and means the world to us.</p>
  `);

  return sendGridSend(email, `How was Order #${orderId}? — ${APP_NAME}`, html);
}

export async function sendAbandonedCart(email: string, _cartSummary: string): Promise<boolean> {
  const html = baseTemplate('You Left Items in Your Cart!', `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">Don't miss out! Your favorites are waiting. Complete your order now.</p>
    <div style="text-align:center;">
      <a href="${APP_URL}/cart" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Complete Order</a>
    </div>
  `);

  return sendGridSend(email, `Complete Your Order — ${APP_NAME}`, html);
}

export async function sendReEngagement(email: string, name: string): Promise<boolean> {
  const html = baseTemplate(`We Miss You, ${escapeHtml(name)}!`, `
    <p style="color:#666;font-size:15px;line-height:1.6;margin:0 0 20px;">It's been a while since your last order. Come back and enjoy our food!</p>
    <div style="text-align:center;">
      <a href="${APP_URL}/menu" style="display:inline-block;background:#e23744;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Order Now</a>
    </div>
  `);

  return sendGridSend(email, `We Miss You! — ${APP_NAME}`, html);
}

export async function sendAdminAlert(emails: string[], subject: string, body: string): Promise<boolean> {
  const html = baseTemplate('System Alert', `
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;margin-bottom:16px;">
      <pre style="margin:0;font-family:monospace;font-size:13px;color:#92400e;white-space:pre-wrap;">${escapeHtml(body)}</pre>
    </div>
    <p style="color:#999;font-size:12px;">This is an automated alert from the kitchen management system.</p>
  `);

  let allSuccess = true;
  for (const email of emails) {
    const ok = await sendGridSend(email, `[ALERT] ${subject}`, html);
    if (!ok) allSuccess = false;
  }
  return allSuccess;
}

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

  return sendGridSend(adminEmail, `Contact Form: ${escapeHtml(subject) || 'No subject'} — ${APP_NAME}`, html);
}
