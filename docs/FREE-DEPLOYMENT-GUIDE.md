# 🚀 Free Deployment Guide — The Katanguri's Kitchen

## Architecture (100% Free Tier)

```
┌─────────────────────────────────────────────────┐
│                    VERCEL (Free)                 │
│  ┌─────────────┐  ┌─────────────────────────┐   │
│  │  Web App    │  │  Admin Dashboard         │   │
│  │  (Next.js)  │  │  (Next.js)               │   │
│  │  :3000      │  │  /admin                  │   │
│  └──────┬──────┘  └────────────┬──────────────┘  │
│         │                      │                  │
│         └──────────┬───────────┘                  │
│                    │ API proxy rewrite            │
└────────────────────┼────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────┐
│              RENDER (Free)                       │
│  ┌─────────────────┴────────────────────────┐    │
│  │           Fastify API Server             │    │
│  │           :3001                          │    │
│  └──────────────┬───────────────────────────┘    │
│                 │                                │
│  ┌──────────────┴───────────────────────────┐    │
│  │    Supabase PostgreSQL (Free)            │    │
│  │    Upstash Redis (Free)                  │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Free Tier Limits

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Hobby | 100GB bandwidth, 100K invocations, serverless functions |
| **Render** | Free | 750 hrs/mo, spins down after 15min inactivity |
| **Supabase** | Free | 500MB database, 50K MAU, 1GB file storage |
| **Upstash** | Free | 10K commands/day, 256MB storage |

---

## Step 1: Set Up Supabase (Free PostgreSQL)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Note your:
   - **Project URL** (e.g., `https://xxxx.supabase.co`)
   - **Anon Key** (Settings → API → anon public)
   - **Service Role Key** (Settings → API → service_role secret)
   - **Database URL** (Settings → Database → Connection string → URI)

4. In the SQL Editor, run the schema migration:
   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

5. Then use Drizzle to push your schema:
   ```bash
   # Set DATABASE_URL to your Supabase connection string
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres"
   
   npm run db:push
   ```

---

## Step 2: Set Up Upstash (Free Redis)

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Click "Create Database"
3. Choose **Redis** → Region closest to your users
4. Note your:
   - **Redis URL** (e.g., `rediss://xxxx@xxxx.upstash.io:6379`)

---

## Step 3: Deploy API on Render (Free)

1. Go to [render.com](https://render.com) and create a free account
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** `kitchen-api`
   - **Runtime:** Node
   - **Build Command:**
     ```bash
     cd apps/api && npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     cd apps/api && node dist/index.js
     ```
   - **Port:** `3001`

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres
   REDIS_URL=rediss://xxxx@xxxx.upstash.io:6379
   JWT_SECRET=[generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"]
   JWT_REFRESH_SECRET=[generate another one]
   CORS_ORIGINS=https://your-web.vercel.app,https://your-admin.vercel.app
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   APP_URL=https://your-web.vercel.app
   ```

6. Deploy! Your API will be at `https://kitchen-api.onrender.com`

---

## Step 4: Deploy Web App on Vercel

1. Go to [vercel.com](https://vercel.com) and create a free account
2. Click "Import Project" → Select your GitHub repo
3. **Root Directory:** `apps/web`
4. **Framework:** Next.js (auto-detected)
5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx (optional)
   NEXTAUTH_URL=https://your-web.vercel.app
   NEXTAUTH_SECRET=[generate one]
   ```

6. Deploy! Your web app will be at `https://your-web.vercel.app`

---

## Step 5: Deploy Admin on Vercel

1. In the same Vercel project, go to Settings → Domains
2. Or create a second Vercel project:
   - **Root Directory:** `apps/admin`
   - **Framework:** Next.js

3. Add Environment Variables (same as web app)

4. Deploy! Your admin will be at `https://your-admin.vercel.app/admin`

---

## Step 6: Update CORS and API URLs

After deployment, update these environment variables:

**On Render (API):**
```
CORS_ORIGINS=https://your-web.vercel.app,https://your-admin.vercel.app
APP_URL=https://your-web.vercel.app
```

**On Vercel (Web):**
```
NEXT_PUBLIC_API_URL=https://kitchen-api.onrender.com
```

---

## Step 7: Run Database Migrations

```bash
# Set your Supabase DATABASE_URL
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"

# Push schema
npm run db:push

# Seed data
npm run seed
```

---

## Alternative: All-in-One on Render (Simplest)

If you want everything on one platform:

1. Create a Render **Blueprint** (`render.yaml`):
   ```yaml
   services:
     - type: web
       name: kitchen-api
       runtime: node
       buildCommand: cd apps/api && npm install && npm run build
       startCommand: cd apps/api && node dist/index.js
       envVars:
         - key: DATABASE_URL
         fromDatabase:
           name: kitchen-db
           property: connectionString
         - key: REDIS_URL
           fromRedis:
             name: kitchen-redis
             property: connectionString

     - type: web
       name: kitchen-web
       runtime: node
       buildCommand: cd apps/web && npm install && npm run build
       startCommand: cd apps/web && node apps/web/server.js
       envVars:
         - key: API_URL
           fromService:
             name: kitchen-api
             property: host

     - type: web
       name: kitchen-admin
       runtime: node
       buildCommand: cd apps/admin && npm install && npm run build
       startCommand: cd apps/admin && node apps/admin/server.js
       envVars:
         - key: API_URL
           fromService:
             name: kitchen-api
             property: host

   databases:
     - name: kitchen-db
       plan: free
       databaseName: kitchen_db
     - name: kitchen-redis
       plan: free
   ```

2. Deploy with: `render blueprint apply render.yaml`

---

## ⚠️ Important Notes

1. **Render Free Tier spins down** after 15 minutes of inactivity. First request takes ~60 seconds to wake up. For production, upgrade to paid tier ($7/mo).

2. **Supabase Free Tier** expires after 7 days of inactivity (project pausing). Keep it active by querying occasionally.

3. **Upstash Free Tier** has 10K commands/day limit. Monitor usage.

4. **SSL/HTTPS** is automatic on Vercel and Render.

5. **Custom Domain** is free on Vercel and Render.

---

## Quick Start Commands

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy Web
cd apps/web
vercel --prod

# 3. Deploy Admin
cd apps/admin
vercel --prod

# 4. Deploy API (on Render dashboard)
# Connect GitHub repo, set environment variables, deploy

# 5. Set up database
npm run db:push
npm run seed
```

---

## Cost Summary

| Service | Monthly Cost |
|---------|--------------|
| Vercel (Hobby) | **$0** |
| Render (Free) | **$0** |
| Supabase (Free) | **$0** |
| Upstash (Free) | **$0** |
| **Total** | **$0/month** |

---

## When You're Ready to Scale

- **Vercel Pro:** $20/mo — More bandwidth, custom domains, team features
- **Render Standard:** $7/mo — No spin-down, faster builds
- **Supabase Pro:** $25/mo — 8GB database, daily backups
- **Upstash Pro:** $10/mo — 100K commands/day, persistence

Start free, scale when you have paying customers! 🚀
