# The Katanguri's Kitchen — Cloud Kitchen Automation Platform

A full-stack cloud kitchen automation system with real-time order management, AI-powered insights, multi-channel dispatch, and production-grade infrastructure.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Nginx   │────▶│  Web App │     │  Admin   │
│  (proxy) │────▶│ (Next.js)│     │ (Next.js)│
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
               ┌──────▼──────┐
               │   API        │
               │  (Fastify)   │
               └──┬───────┬──┘
                  │       │
          ┌───────▼┐  ┌───▼──────┐
          │ Postgres│  │  Redis   │
          └────────┘  └──────────┘
```

**Services:** API (Fastify), Web (Next.js), Admin (Next.js), PostgreSQL, Redis, Nginx, Prometheus, Grafana

## Quick Start

```bash
# 1. Generate environment files and secrets
npm run setup

# 2. Start infrastructure
npm run docker:up

# 3. Seed the database
npm run seed

# 4. Start all apps in development mode
npm run dev
```

- Customer app: http://localhost:3000
- Admin dashboard: http://localhost:3002
- API docs (dev only): http://localhost:3001/docs

## Production Deployment

### Prerequisites

- Docker & Docker Compose v2+
- A domain name with DNS configured
- (Optional) Certbot for SSL/TLS

### 1. Configure Environment

```bash
# Copy the production example and fill in real values
cp .env.production.example .env

# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 2. SSL/TLS Setup

```bash
# Start nginx without SSL first
docker compose up -d nginx

# Obtain certificates
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d thekatanguriskitchen.com -d admin.thekatanguriskitchen.com

# Uncomment SSL blocks in docker/nginx/nginx.conf
# Reload nginx
docker compose exec nginx nginx -s reload
```

### 3. Deploy

```bash
# Build and start all services
docker compose up -d --build

# Migrations run automatically via the API entrypoint
# Seed initial data (first deploy only, from host machine)
npx tsx scripts/seed.ts
```

### 4. Verify

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Metrics (internal only)
curl http://localhost:3001/api/v1/metrics
```

## Environment Variables

All required variables are documented in `.env.production.example`. Key categories:

| Category | Variables |
|----------|-----------|
| Database | `POSTGRES_PASSWORD`, `DATABASE_URL` |
| Cache | `REDIS_PASSWORD`, `REDIS_URL` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| AI | `GEMINI_API_KEY`, `GROQ_API_KEY` |
| Dispatch | `DISPATCH_API_KEY` |

## Monitoring

- **Prometheus:** http://localhost:9090 — scrapes API metrics
- **Grafana:** http://localhost:3003 — dashboards & alerting
- **Health:** `GET /api/v1/health` — returns DB + Redis status
- **Metrics:** `GET /api/v1/metrics` — Prometheus format (internal only)

## Development

```bash
npm run dev          # Start all apps
npm run test         # Run API tests
npm run test:e2e     # Run Playwright E2E tests
npm run typecheck    # Type-check all apps
npm run lint         # Lint entire monorepo
```

## Tech Stack

- **API:** Fastify, Drizzle ORM, PostgreSQL, Redis, BullMQ
- **Web:** Next.js, React, Stitches CSS
- **Admin:** Next.js, React, Stitches CSS
- **Auth:** JWT + Supabase Auth
- **Payments:** Stripe
- **Email:** SendGrid
- **SMS:** Twilio
- **AI:** Gemini, Groq
- **Monitoring:** Prometheus, Grafana
- **CI/CD:** GitHub Actions, Docker, GHCR
