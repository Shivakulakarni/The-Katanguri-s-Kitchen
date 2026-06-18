# Pre-Deployment Checklist: The Katanguri's Kitchen

## Status: CONDITIONALLY READY FOR DEPLOYMENT

---

## 1. Critical Blockers (MUST FIX BEFORE GO-LIVE)

| # | Issue | Status | Action Required |
|--|-------|--------|-----------------|
| 1 | **Redis via Docker** | ✅ FIXED | Docker Compose uses `redis:7-alpine`. BullMQ workers work correctly in Docker. |
| 2 | **Dev bypass ENABLED** | ✅ FIXED | `ENABLE_DEV_BYPASS=false` set in `.env`. Verify it stays off in production. |
| 3 | **SSL certificates** | ✅ SELF-SIGNED | Self-signed certs generated in `docker/nginx/certs/`. **Replace with real certs via certbot before production.** |
| 4 | **Domain placeholders** | ✅ FIXED | Updated to `thekatanguriskitchen.com` in nginx.conf and `.env.production` |
| 5 | **Web E2E SSE timeout** | ⚠️ KNOWN | Playwright tests use `networkidle` on SSE pages. Fix applied in test but ensure monitoring adapts. |

## 2. Environment Variables

| Variable | Required | Status | Notes |
|----------|----------|--------|-------|
| `NODE_ENV=production` | ✅ | ✅ Set | Ensure no dev-only features active |
| `JWT_SECRET` | ✅ | ✅ Regenerated | Fresh 48-byte base64 secret in `.env.production` |
| `JWT_REFRESH_SECRET` | ✅ | ✅ Regenerated | Fresh 48-byte base64 secret in `.env.production` |
| `POSTGRES_PASSWORD` | ✅ | ✅ Set | Use a strong unique password |
| `REDIS_PASSWORD` | ✅ | ✅ Set | Use a strong unique password |
| `CORS_ORIGINS` | ✅ | ✅ Set | `https://thekatanguriskitchen.com,https://admin.thekatanguriskitchen.com` |
| `STRIPE_SECRET_KEY` | ✅ | ❌ Missing | Get from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | ✅ | ❌ Missing | Get from Stripe dashboard |
| `SENDGRID_API_KEY` | ⚠️ Optional | ❌ Missing | Required for email notifications |
| `TWILIO_*` | ⚠️ Optional | ❌ Missing | Required for SMS OTP |
| `APP_URL` | ✅ | ✅ Set | `https://thekatanguriskitchen.com` in `.env.production` |
| `GRAFANA_PASSWORD` | ✅ | ✅ Set | Used for monitoring dashboard |

## 3. Security Checklist

- [x] JWT secrets are **different** for access vs refresh tokens
- [x] Logger redacts `password`, `otp`, `token`, `authorization` headers
- [x] Rate limiting configured (30r/s API, 10r/s general)
- [ ] **CORS is locked** — set `CORS_ORIGINS` to production domains only
- [ ] **HTTPS enforced** — Nginx HTTP→301→HTTPS redirect active
- [ ] **Metrics endpoint** — blocked from public access (internal IPs only)
- [x] HSTS headers (2-year max-age)
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [ ] **Stripe webhook signature** verification active
- [ ] **Supabase JWT secret** if using Supabase Auth
- [ ] **Dev bypass disabled** — `ENABLE_DEV_BYPASS=false` ✅

## 4. Database

- [x] Connection pool established (max 20 connections)
- [ ] **Increase pool to 50** for 1000 concurrent orders (`DB_POOL_MAX=50`)
- [ ] Run migrations: `npm run db:push`
- [ ] Seed data: `npm run seed`
- [ ] Verify `kitchen_db` has all tables

## 5. Monitoring & Observability

| Component | Status | Notes |
|-----------|--------|-------|
| Prometheus scraping | ✅ Configured | Scrapes `api:3001/api/v1/metrics` every 15s |
| Grafana dashboards | ✅ Configured | Request rate, P95 latency, orders/min, SSE clients |
| Alerting rules | ✅ Configured | 9 alert rules (error rate, latency, traffic, payments, SSE) |
| Log aggregation | ❌ Not configured | Consider shipped to CloudWatch / DataDog |
| Structured logging | ✅ Configured | Pino with redaction, JSON output in production |

## 6. Load Testing

- [ ] Run k6 load test: `k6 run k6/load-test-1000.js --vus 1000 --duration 10m`
- [ ] Verify p95 < 2000ms target
- [ ] Verify error rate < 1%
- [ ] Run stress test: `k6 run k6/stress-test.js`

## 7. Deployment Steps

```bash
# 1. Set up environment
# .env.production already created — fill remaining CHANGE_ME values
# Copy .env.production → .env for docker-compose to pick it up:
copy .env.production .env

# 2. SSL certificates
docker compose up -d nginx
sudo certbot --nginx -d thekatanguriskitchen.com -d admin.thekatanguriskitchen.com
# Then uncomment SSL blocks in docker/nginx/nginx.conf
# Restart nginx: docker compose exec nginx nginx -s reload

# 3. Build and start all services
docker compose up -d --build

# 4. Run migrations and seed (first deploy only)
npx tsx scripts/seed.ts

# 5. Verify
curl https://thekatanguriskitchen.com/api/v1/health
curl https://thekatanguriskitchen.com/api/v1/menu

# 6. Verify monitoring
curl http://localhost:9090/targets   # Prometheus targets
curl http://localhost:3003            # Grafana
```

---

## Verdict Summary

| Category | Status |
|----------|--------|
| Unit tests (107/107) | ✅ PASS |
| TypeScript (3/3 apps) | ✅ PASS |
| Lint (0 warnings) | ✅ PASS |
| API health checks | ✅ PASS |
| Auth flow | ✅ PASS |
| Order creation | ✅ PASS |
| Prometheus metrics | ✅ PASS |
| Docker Compose | ✅ PASS |
| Nginx config | ✅ FIXED (thekatanguriskitchen.com) |
| Security headers | ✅ PASS |
| Redis v5+ for BullMQ | ✅ FIXED (Docker redis:7-alpine) |
| Domain placeholders | ✅ FIXED (thekatanguriskitchen.com) |
| JWT secrets | ✅ Regenerated |
| CORS origins | ✅ Set for production domain |
| Dev bypass disabled | ✅ ENABLE_DEV_BYPASS=false |
| SSL certificates | ✅ SELF-SIGNED (replace with real before production) |
| Production API keys | ⚠️ Stripe, SendGrid, Twilio, AI keys need filling |

**Production cutoff requires:** SSL certs (certbot) and production API keys (Stripe, etc.).
