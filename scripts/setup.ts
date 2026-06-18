import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function generateSecret(length = 48): string {
  return randomBytes(length).toString('base64url');
}

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < 24; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const root = process.cwd();
const secrets = {
  POSTGRES_PASSWORD: generateStrongPassword(),
  REDIS_PASSWORD: generateStrongPassword(),
  GRAFANA_PASSWORD: generateStrongPassword(),
  JWT_SECRET: generateSecret(),
  JWT_REFRESH_SECRET: generateSecret(),
  NEXTAUTH_SECRET: generateSecret(),
  ADMIN_PASSWORD: generateStrongPassword(),
};

console.log('\n=== The Katanguris Kitchen — Setup ===\n');
console.log('Generated secrets (save these somewhere safe):\n');
for (const [key, value] of Object.entries(secrets)) {
  console.log(`  ${key}=${value}`);
}
console.log('');

function fillSecrets(template: string, extra: Record<string, string> = {}): string {
  const all = { ...secrets, ...extra };
  let content = template;
  for (const [key, value] of Object.entries(all)) {
    content = content.split(`CHANGE_ME_${key}`).join(value);
  }
  content = content
    .split('CHANGE_ME_TO_A_RANDOM_SECRET_64_CHARS_PLUS').join(secrets.JWT_SECRET)
    .split('CHANGE_ME_TO_ANOTHER_RANDOM_SECRET_64_CHARS').join(secrets.JWT_REFRESH_SECRET)
    .split('CHANGE_ME_TO_A_RANDOM_SECRET').join(secrets.JWT_SECRET)
    .split('CHANGE_ME_STRONG_PASSWORD').join(secrets.POSTGRES_PASSWORD)
    .split('CHANGE_ME_STRONG_REDIS_PASSWORD').join(secrets.REDIS_PASSWORD)
    .split('CHANGE_ME_GRAFANA_PASSWORD').join(secrets.GRAFANA_PASSWORD)
    .split('sk_test_CHANGE_ME').join('sk_test_YOUR_STRIPE_SECRET_KEY')
    .split('whsec_CHANGE_ME').join('whsec_YOUR_STRIPE_WEBHOOK_SECRET')
    .split('SG.CHANGE_ME').join('SG.YOUR_SENDGRID_API_KEY')
    .split('CHANGE_ME_TO_ANOTHER_RANDOM_SECRET').join(secrets.JWT_REFRESH_SECRET)
    ;
  return content;
}

function syncEnv(examplePath: string, envPath: string, extra: Record<string, string> = {}): boolean {
  if (!existsSync(examplePath)) {
    console.log(`  Skipped: ${examplePath} not found`);
    return false;
  }
  const template = readFileSync(examplePath, 'utf-8');
  const content = fillSecrets(template, extra);
  writeFileSync(envPath, content);
  return true;
}

// Root .env
console.log('Creating .env files...\n');

if (syncEnv(join(root, '.env.example'), join(root, '.env'))) {
  console.log('  Created .env (root)');
}

// Per-app .env files
const apps: Record<string, Record<string, string>> = {
  'apps/api': {},
  'apps/web': {},
  'apps/admin': {},
};

for (const [app, extra] of Object.entries(apps)) {
  const examplePath = join(root, app, '.env.example');
  const envPath = join(root, app, '.env');
  if (syncEnv(examplePath, envPath, extra)) {
    console.log(`  Created ${app}/.env`);
  }
}

console.log('\n=== Next Steps ===\n');
console.log('1. Edit .env and replace these with your real API keys:');
console.log('   - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET');
console.log('   - SENDGRID_API_KEY');
console.log('   - TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER');
console.log('   - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET');
console.log('   - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
console.log('   - DISPATCH_API_KEY / DISPATCH_API_URL');
console.log('   - SLACK_WEBHOOK_URL');
console.log('   - TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
console.log('   - GROQ_API_KEY / GEMINI_API_KEY');
console.log('');
console.log('2. Start Docker services:');
console.log('   docker compose up -d');
console.log('');
console.log('3. Push DB schema:');
console.log('   npm run db:push');
console.log('');
console.log('4. Seed data:');
console.log('   npm run seed');
console.log('');
console.log('5. Build all apps:');
console.log('   npm run build');
console.log('');
console.log('Admin login:');
console.log(`   Email:    admin@katanguri.com`);
console.log(`   Password: ${secrets.ADMIN_PASSWORD}`);
console.log('');
