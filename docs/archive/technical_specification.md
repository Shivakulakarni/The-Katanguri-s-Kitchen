# Cloud Kitchen Automation System — Technical Specification Document

## 1. Introduction

This document outlines the design and development plan for a full-stack cloud kitchen automation system for a multi-cuisine online ordering business. The primary objective is to replace all manual operational workflows — order intake, inventory checks, payment reconciliation, dispatch coordination, customer communication, and business reporting — with an end-to-end automated digital platform. The system leverages event-driven architecture, background job queues, rule-based triggers, and API integrations to achieve zero-touch handling from order placement to delivery confirmation. The platform is architected for scalability (100+ concurrent users, 500+ orders/day), security (PCI-DSS Level 4, GDPR compliance), and performance (sub-3-second page loads). The solution comprises a responsive customer-facing website, a RESTful backend automation engine, third-party service integrations, and an owner dashboard.

## 2. Business Requirements Analysis

The cloud kitchen operates without a physical dine-in space; revenue depends entirely on online orders. Manual order entry, phone-based communication, and spreadsheet inventory tracking create bottlenecks and errors. Analysis of competitor platforms (e.g., The Katanguri Kitchen) reveals the following functional requirements:

- **Order Management:** Customers must browse categorized menus with dietary tags, customize items (add-ons, portion sizes), place orders, and receive real-time status updates (confirmed → preparing → out-for-delivery → delivered). Orders must auto-flow to kitchen display screens via automated routing rules (priority-based, station-based assignment).
- **Inventory Control:** Ingredient stock must decrement automatically with each order. Low-stock alerts and predicted depletion (based on order velocity) must trigger auto-generated purchase orders to suppliers. Wastage and spoilage logging must be supported with automated variance reporting.
- **Customer Management:** User accounts with order history, saved addresses, preferred payment methods, and feedback/subscription capabilities. Guest checkout must also be supported. Automated lifecycle emails (welcome, re-engagement, win-back) and SMS notifications at every order milestone.
- **Payment Processing:** Secure card payments, digital wallets, and cash-on-delivery options. PCI-DSS-compliant tokenization and automated invoice generation. Auto-reconciliation of daily settlements against order records.
- **Third-Party Integration:** At minimum, one payment gateway (Stripe) and one delivery aggregator (Zomato/Swiggy API or equivalent regional service) for order dispatch and tracking. Automated dispatcher assignment based on geolocation and rider availability.
- **Automation Requirements:** The system must achieve zero-touch order processing — from placement to delivery — using rule-based triggers, background job queues, and event-driven workflows. All manual interventions (refunds, stock adjustments, menu updates) must be logged and auditable. Scheduled tasks must handle end-of-day reconciliation, report generation, data backups, and supplier purchase orders.
- **Non-Functional Requirements:** 99.9% uptime during business hours; end-to-end encryption (TLS 1.3); role-based access control (customer, kitchen staff, admin); <3 s Time to Interactive (TTI) on 3G throttled connections. All automated workflows must include dead-letter queues, retry logic with exponential backoff, and human-in-the-loop fallback for critical failures.

## 3. Website Design and Development Plan

### 3.1 Technology Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Frontend     | Next.js 14 (React, SSR)           |
| Styling      | @stitches/react (CSS-in-JS design system with SSR injection) |
| State        | React Query (server state) + Zustand (client state) |
| SEO          | next/sitemap, structured data (JSON-LD), server-side rendering |
| Performance  | Image optimization (next/image), dynamic imports, CDN (Cloudflare) |

### 3.2 Site Architecture

The customer-facing site is composed of the following pages:

- **Landing/Home:** Hero banner with featured cuisines, promotional carousel, trust signals.
- **Menu:** Category-filtered grid (North Indian, Chinese, Continental, etc.), dish cards with price, estimated prep time, dietary icons (veg/non-veg/spicy). Clicking a card opens a quick-view modal with customization options.
- **Cart:** Side-drawer cart with real‑time total recalculation, promo code field, and a sticky checkout CTA.
- **Checkout:** Address selection/input, delivery time slot picker, payment method selection, order summary. Fully responsive, with progressive form validation.
- **Order Tracking:** Polls backend every 5 seconds (WebSocket fallback for modern browsers). Displays status timeline, estimated delivery time, and live rider location on an embedded map.
- **Auth:** Email/OTP login, Google OAuth, guest checkout link.
- **Account:** Order history, saved addresses, preferences, subscription management.

### 3.3 Responsive Design

Mobile-first breakpoints: 375px, 768px, 1024px, 1440px. All layouts tested against Lighthouse mobile profile (target: 90+ Performance, 90+ Accessibility, 90+ SEO). Images use next/image with WebP format, lazy loading, and srcset for density descriptors.

## 4. Backend System Design and Development Plan

### 4.1 Technology Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Runtime        | Node.js 20 LTS                      |
| Framework      | Fastify (high throughput, schema validation) |
| Language       | TypeScript (strict mode)            |
| Database       | PostgreSQL 16 (primary), Redis 7 (cache + session + queue) |
| ORM            | Drizzle ORM (type-safe, zero-cost)  |
| Queuing        | BullMQ (backed by Redis)            |
| Auth           | JWT (access + refresh tokens), bcrypt |
| API            | RESTful (documented via OpenAPI 3.1) |
| Container      | Docker + docker-compose             |

### 4.2 Module Breakdown

The backend is decomposed into six bounded contexts:

**1. Menu Service**
- CRUD for categories, dishes, modifiers, dietary tags.
- Redis caching with cache invalidation on write (cache-aside pattern).
- Image upload pipeline (Multer → sharp for resizing → S3-compatible object storage).

**2. Order Service**
- Accepts orders, validates stock via atomic Redis locks, deducts inventory, publishes `order.placed` event.
- State machine: `PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED` (with `CANCELLED` and `REJECTED` terminals).
- Each transition emits a server-sent event (SSE) to the customer tracking page.
- BullMQ job retries failed order confirmations (max 3 retries with exponential backoff).

**3. Inventory Service**
- Tracks ingredient stock, unit conversions, and par levels.
- Event-driven: consumes `order.placed` events to decrement stock. Produces `stock.low` and `stock.depleted` events.
- Forecasting: applies exponential moving average on daily consumption to recommend reorder quantities.

**4. Customer Service**
- Registration, authentication, profile management, address book.
- Rate limiting (40 req/min per IP, 200 req/min per authenticated user) via Redis sliding window.

**5. Payment Service**
- Wraps Stripe SDK. Handles `payment_intent.create`, `payment_intent.confirm`, webhook processing for `payment_intent.succeeded` / `payment_intent.payment_failed`.
- Idempotency keys prevent duplicate charges. All sensitive data is tokenized; raw card numbers never reach the server.

**6. Dispatch Service**
- Integrates with delivery aggregator API (e.g., Zomato Fleet or Shiprocket).
- On `READY` status, dispatches pickup request. Polls delivery status and updates order tracking.

### 4.3 Database Schema (Key Entities)

```
dishes(id, category_id, name, description, price, prep_time_min,
       dietary_tags[], image_url, is_available, created_at)

order_items(id, order_id, dish_id, quantity, unit_price, modifiers)

orders(id, customer_id, status, total_amount, delivery_address_id,
       payment_intent_id, dispatch_id, created_at, updated_at)

ingredients(id, name, unit, current_stock, par_level, unit_cost)

inventory_transactions(id, ingredient_id, change_qty, reason, reference_id)
```

Indexes on `orders.status`, `orders.created_at`, `dishes.category_id`, and full-text search on `dishes.name`.

### 4.4 API Endpoints (Key Routes)

| Method | Route                              | Description                  |
|--------|------------------------------------|------------------------------|
| GET    | `/api/v1/menu?category={id}`       | List dishes (cached)         |
| POST   | `/api/v1/orders`                   | Place order                  |
| GET    | `/api/v1/orders/:id`               | Get order + status           |
| POST   | `/api/v1/orders/:id/cancel`        | Cancel order                 |
| GET    | `/api/v1/inventory/stock`          | Current stock levels (admin) |
| POST   | `/api/v1/auth/register`            | Customer registration        |
| POST   | `/api/v1/payments/create-intent`   | Stripe payment intent        |
| POST   | `/api/v1/webhooks/stripe`          | Stripe event webhook         |

### 4.5 Security & Compliance

- **PCI-DSS:** Stripe Elements handles card data client-side; backend receives only a `payment_method_id`. No card data stored.
- **GDPR:** Cookie consent banner; user data export/deletion endpoints; 30-day log retention; data encryption at rest (AES-256).
- **Helmet.js** headers (CSP, HSTS, X-Frame-Options). Rate limiting per route. Input validation via Fastify's JSON Schema (Ajv). SQL injection prevented by Drizzle ORM parameterized queries.
- **Audit logging** for all admin actions (who changed stock/price at what time).

## 5. Payment Processing and Integration Plan

**Primary Gateway — Stripe:**
- Client-side: Stripe Elements or Stripe Checkout (prebuilt UI) renders card input. Payment Intent API confirms asynchronously.
- Server-side: Webhook endpoint (`/api/v1/webhooks/stripe`) listens for `payment_intent.succeeded`, `payment_intent.payment_failed`. On success, order status transitions to `CONFIRMED`. On failure, customer receives a toast notification and is prompted to retry.
- Refunds: Admin dashboard triggers Stripe Refund API with idempotency key; funds returned in 5–10 business days.

**Secondary Gateway (Fallback) — Razorpay (or regional equivalent):**
- Activated if Stripe charge fails (retry logic via BullMQ). Same tokenization pattern.
- Both gateways store transaction ID, amount, currency, and status in a unified `payments` table for reconciliation.

**Invoicing:**
- On successful payment, a background job generates a PDF invoice (PDFKit) and emails it via SendGrid.

## 6. Automation System Design

The automation layer is the core differentiator of this platform. It operates as a set of event-driven workflows, cron-based schedulers, and rule engines that eliminate manual effort across the entire order lifecycle.

### 6.1 Automation Architecture

```
┌──────────────┐     Events      ┌──────────────────┐     Jobs      ┌──────────────┐
│   Services   │ ──────────────→ │   Event Bus      │ ────────────→ │   BullMQ     │
│ (Order, Inv, │                 │ (Redis Pub/Sub)  │               │   Workers    │
│  Payment...) │                 └──────────────────┘               └──────┬───────┘
└──────────────┘                                                         │
                                                                         ▼
                                                               ┌──────────────────┐
                                                               │   Action Handlers│
                                                               │ (Email, SMS, API,│
                                                               │  Slack, Webhook) │
                                                               └──────────────────┘
```

Every service publishes events to a Redis Pub/Sub bus. BullMQ workers consume these events and execute idempotent actions. Failed jobs are retried (up to 3 times) then moved to a dead-letter queue for admin review.

### 6.2 Automated Workflows

#### 6.2.1 Order-to-Kitchen Automation

| Trigger                     | Automated Action                                               |
|-----------------------------|---------------------------------------------------------------|
| `order.placed`              | Validate inventory → reserve stock (atomic Redis lock) → publish `order.confirmed` or `order.rejected` |
| `order.confirmed`           | Assign to kitchen station (by cuisine type load-balancing) → push to KDS (Kitchen Display Screen) → print docket via thermal printer API |
| `order.preparation_started` | Send SMS "Your order is being prepared" + estimated time      |
| `order.ready`               | Notify dispatch service → auto-assign nearest rider           |
| `order.out_for_delivery`    | Send SMS with live tracking link + rider name & phone         |
| `order.delivered`            | Trigger feedback request (SMS after 30 min) → update customer lifetime value score |

#### 6.2.2 Inventory Automation

- **Auto-decrement:** Every `order.confirmed` event triggers an inventory deduction workflow. Bulk orders decrement in a single Redis transaction for consistency.
- **Low-stock alerts:** A BullMQ recurring job (runs every 15 minutes) scans ingredients where `current_stock < par_level`. For items below threshold, it auto-generates a purchase order draft and notifies the admin via dashboard notification + Slack/Telegram bot.
- **Depletion forecasting:** A daily cron job (02:00) runs Holt-Winters time-series forecasting on consumption data (last 90 days). Ingredients predicted to hit zero within 48 hours are flagged with "CRITICAL — ORDER NOW" priority. The forecast model is retrained weekly.
- **Wastage auto-logging:** If `inventory_transactions` records a negative adjustment with reason = "spoilage" exceeding 5% of daily usage, an alert is sent to the admin and a wastage report is appended to the weekly summary.

#### 6.2.3 Payment Automation

- **Auto-reconciliation:** A BullMQ worker scheduled at 23:59 daily fetches Stripe balance transactions for the day, matches them against the `payments` table by `payment_intent_id`, and flags discrepancies (< 0.5% tolerance auto-resolved; > 0.5% escalated to admin).
- **Refund automation:** If order is cancelled before preparation starts, refund is auto-triggered via Stripe API. If cancelled after preparation starts, a manual approval workflow is initiated (admin must confirm within 30 minutes or auto-approve with notification).
- **Invoice generation:** On `payment_intent.succeeded`, a background worker generates a PDF invoice (PDFKit), uploads to S3, and emails it via SendGrid. Failed invoice generation is retried 3 times then queued for manual review.

#### 6.2.4 Customer Communication Automation

| Event                        | Channel    | Template                              | Delay         |
|------------------------------|------------|---------------------------------------|---------------|
| Order confirmed              | SMS + Email| "Order #XYZ confirmed. ETA: 30 min"   | Immediate     |
| Order out for delivery       | SMS        | "Rider Raj (M) is on the way" + link  | Immediate     |
| Order delivered              | SMS        | "Enjoy your meal! Rate us:" + URL     | +30 min       |
| Abandoned cart (logged in)   | Email      | "You left items in your cart" + 10% coupon | +60 min  |
| Abandoned cart (guest)       | SMS        | "Complete your order" + link          | +30 min       |
| No orders in 14 days        | Email      | "We miss you! Flat 15% off"           | 14 days after last order |
| Low wallet balance           | Email      | "Your wallet balance is low"          | Immediate     |

#### 6.2.5 Dispatch Automation

- On `order.ready` event, the dispatch worker queries the delivery aggregator API for available riders within 2 km of the kitchen.
- Rider is auto-assigned based on: shortest ETA → highest rating → lowest active orders.
- Dispatch request includes pickup time, drop-off coordinates, and order value (for high-value order handling).
- Rider status is polled every 30 seconds. If no rider accepts within 3 minutes, escalation triggers: the kitchen screen shows a "RIDER NOT FOUND" alert, and the admin receives a Telegram notification.
- If the delivery aggregator API is down, the system falls back to a manual dispatch mode: the KDS displays a QR code with delivery details for walk-in riders.

### 6.3 Scheduled Cron Jobs

| Cron Schedule   | Job                              | Description                                         |
|-----------------|----------------------------------|-----------------------------------------------------|
| Every 15 min    | `inventory:low-stock-scan`       | Scan for low-stock ingredients, alert admin         |
| Every 60 min    | `analytics:compute-hourly`       | Compute hourly revenue, order count, avg prep time  |
| Daily 02:00     | `inventory:forecast`             | Run depletion forecast, flag critical items         |
| Daily 23:59     | `payments:reconcile`             | Auto-reconcile daily Stripe settlements             |
| Daily 03:00     | `db:backup`                      | Full database backup to S3 (retention: 30 days)     |
| Daily 04:00     | `reports:generate-daily`         | Generate and email daily business summary PDF       |
| Weekly Mon 05:00| `reports:generate-weekly`        | Generate weekly analytics report (charts + tables)  |
| Monthly 01:00   | `compliance:audit-log-archive`   | Archive audit logs older than 90 days to cold storage |

### 6.4 Rule Engine

A lightweight JSON-based rule engine powers conditional automation without code changes. Rules are stored in a `rules` table and evaluated at runtime:

```json
{
  "id": "refund-auto-approve",
  "trigger": "order.cancelled",
  "conditions": [
    { "field": "order.status", "op": "eq", "value": "CONFIRMED" },
    { "field": "order.elapsed_minutes", "op": "lt", "value": 5 },
    { "field": "order.total_amount", "op": "lt", "value": 1500 }
  ],
  "actions": [
    { "type": "refund", "params": { "full": true } },
    { "type": "notification", "params": { "channel": "email", "template": "refund-initiated" } }
  ]
}
```

The admin can create/modify rules via the dashboard without redeployment. The rule engine is evaluated synchronously for order-critical paths (cancellation, stock deduction) and asynchronously for non-critical paths (notifications, analytics).

### 6.5 Human-in-the-Loop Fallbacks

Critical automations include escalation paths when automated actions fail or conditions fall outside configured thresholds:

| Automation                   | Fallback                                              |
|------------------------------|-------------------------------------------------------|
| Inventory auto-deduction     | If Redis lock fails after 3 retries → job to dead-letter queue → admin notified |
| Auto rider assignment        | If no rider found after 3 min → KDS alert + admin Telegram notification |
| Auto-refund                  | If order already in preparation → manual approval via dashboard |
| Auto-reconciliation          | If discrepancy > 0.5% → flagged in dashboard for manual review |
| Email/SMS delivery           | If provider returns 5xx after 3 retries → logged; admin notified if > 5 failures in 1 hour |
| Abandoned cart recovery      | If customer has unsubscribed → suppressed automatically |

### 6.6 Monitoring Automated Workflows

- **Workflow Dashboard:** Real-time view of all running, completed, failed, and queued automations. Built using Bull Board (BullMQ UI).
- **SLIs tracked per workflow:** p50/p95/p99 execution time, success rate (target > 99.5%), mean time to acknowledge failure (target < 5 min).
- **Anomaly detection:** Prometheus metrics feed into a Grafana alert: if any automation's failure rate exceeds 2% in a 5-minute window, PagerDuty pages the on-call engineer.
- **Audit trail:** Every automated action is logged to the `automation_logs` table with `workflow_name, event_id, action, status, duration_ms, error_message, timestamp`. Immutable via database-level triggers (append-only).

## 8. Dashboard Design and Development Plan

### 8.1 Frontend

Built as a separate Next.js app under `/admin` subdomain, authenticated via a separate JWT with elevated claims.

**Key pages:**
- **Overview:** KPI cards (total orders today, revenue, top dishes, pending orders). Charts (Recharts) for hourly order volume, revenue trend (7/30 days). Automation health summary widget showing success/failure rates of all active automations.
- **Orders:** Searchable, filterable data table (TanStack Table). Bulk status updates. Click-to-view order detail with itemized list and customer info. Auto-refresh every 10 seconds for real-time awareness.
- **Automation Workflows:** Dedicated page showing each automated workflow (order-to-kitchen, inventory deduction, dispatch assignment, payment reconciliation, customer communication) with toggle enable/disable switches. Real-time metrics: executions (24h), success rate, avg execution time, dead-letter queue depth. Click into a workflow to view individual execution logs with timestamps, payloads, and error messages.
- **Rule Engine Editor:** Visual rule builder (conditions builder + action picker) for creating/modifying automation rules. JSON editor view for advanced users. Version history with rollback capability. Dry-run mode to test rules against historical events without side effects.
- **Inventory:** Real-time stock view with color-coded rows (green > par level, yellow < par level, red = zero). "Add Stock" modal. Reorder suggestions list generated by the forecasting engine. Auto-generated purchase orders visible with "Approve & Send" action.
- **Menu Management:** Drag-and-drop category/dish reordering. Toggle availability per dish. Bulk price update.
- **Customers:** Searchable table with order count, lifetime value, last order date. Export to CSV. Automation opt-out toggle per customer (suppress all marketing automations).
- **Analytics:** Revenue breakdown by cuisine/category, peak hours, average prep time, cancellation rate. Automation efficiency report: manual interventions saved (e.g., "Automation handled 94% of orders today"), average time saved per order, most-triggered automations.
- **Automation Audit Log:** Searchable, filterable table of all automated actions with status, duration, and error details. Export to CSV for compliance review.
- **Settings:** Delivery zones, tax configuration, opening hours, notification preferences. Automation thresholds (low-stock par levels, auto-refund max amount, rider assignment timeout).

### 8.2 Backend (Admin API)

Adds `admin` role to JWT. Endpoints are namespaced under `/api/v1/admin/` and enforce role-based middleware. Read models use materialized views refreshed every 5 minutes for performance on aggregate queries.

## 9. Testing, Deployment & Maintenance

### 9.1 Testing Strategy

| Type              | Tool                         | Scope                                        |
|-------------------|------------------------------|----------------------------------------------|
| Unit              | Vitest                       | Services, utilities, validation schemas, rule engine conditions |
| Integration       | Supertest + Testcontainers   | API endpoints with real DB and Redis, BullMQ job execution |
| E2E               | Playwright                   | Customer checkout flow, admin CRUD, payment, automated workflow triggers |
| Load              | k6                           | Simulate 100 concurrent users, 500 orders/day, 1000 automation events/min |
| Automation        | Custom harness               | Trigger each event type and assert correct automated actions, retry logic, dead-letter routing, rule engine evaluation with edge cases |

Coverage threshold: ≥ 85% lines, ≥ 90% critical paths (order lifecycle, payment, inventory auto-deduction, dispatch auto-assignment).

### 9.2 CI/CD Pipeline

- **GitHub Actions** triggers on push to `main` and PRs:
  1. Lint (ESLint + Prettier)
  2. Type check (tsc —noEmit)
  3. Unit + integration tests
  4. Build Docker images
  5. Push to container registry (GHCR)
  6. Deploy to staging (via Helm to Kubernetes)
  7. Smoke tests (5 critical user journeys)
  8. Promote to production (blue-green deployment)

### 9.3 Infrastructure

- **Compute:** Kubernetes cluster (DigitalOcean or AWS EKS), 2 nodes (4 vCPU, 8 GB RAM), auto-scaling to 5 nodes under load.
- **Database:** Managed PostgreSQL (RDS or Cloud SQL) with automated backups and point-in-time recovery. Read replica for analytics queries.
- **CDN:** Cloudflare for static assets, edge caching of menu API responses (TTL 60 s).
- **Monitoring:** Sentry (error tracking), Grafana + Prometheus (metrics: request latency, error rate, queue depth, DB connections), PagerDuty alerting on p95 latency > 3 s.

### 9.4 Maintenance

- Weekly dependency updates (Renovate bot).
- Monthly load test to validate capacity.
- Quarterly PCI-DSS self-assessment.
- On-call rotation with runbook for common incidents (DB replica failover, Stripe webhook delay, Redis OOM).

## 10. Conclusion and Recommendations

The proposed system replaces fragmented manual processes with a cohesive, event-driven automation platform capable of handling the target throughput (100 concurrent users, 500 orders/day) while maintaining PCI-DSS and GDPR compliance. The Next.js frontend delivers sub-3-second load times via SSR, image optimization, and CDN caching. The Fastify-based backend ensures type safety, low latency, and clear separation of concerns across six microservice contexts. Stripe integration handles payment security, and the dispatch service automates delivery handoff.

The automation engine is the centerpiece of this solution — it achieves zero-touch processing across the entire order lifecycle via event-driven workflows, BullMQ job queues, a JSON-based rule engine, and scheduled cron jobs. Every manual action has an automated counterpart with built-in retry logic, dead-letter escalation, and human-in-the-loop fallbacks. The admin dashboard provides not just visibility into orders and revenue, but also real-time monitoring of every automated workflow, a visual rule editor, and an audit trail for compliance.

**Recommendations:**
1. Build the automation workflows incrementally — start with order-to-kitchen and inventory deduction in the MVP, then add payment reconciliation, dispatch automation, and customer communication in subsequent sprints.
2. Invest in automated E2E tests for every workflow before launch; manual regression testing is too slow for weekly releases.
3. Negotiate delivery aggregator contracts early — API access and commission rates affect dispatch automation design.
4. Plan for Phase 2 features: loyalty program automation, multi-language support, AI-based demand forecasting, and WhatsApp ordering with NLP-driven order parsing.

---

*Document version 1.0 — Prepared for cloud kitchen automation project.*
