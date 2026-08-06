# backend-tredella

GraphQL API for the Tredella multi-vendor marketplace (retail + wholesale, AED).
Consumed by the Next.js buyer website today and a React Native app later —
all business rules (tier pricing, stock, review eligibility, order splitting)
live here, never in the frontend.

## Stack

- Node.js + Express + TypeScript
- Apollo Server (GraphQL) + graphql-ws subscriptions (chat, notifications)
- Prisma ORM — SQLite in dev (zero setup), PostgreSQL-ready schema
- JWT auth with BUYER / SELLER / ADMIN roles (dashboards come later)

## Quick start

```bash
npm install
npm run db:push     # create the dev database
npm run db:seed     # 56 products, 4 sellers, demo users
npm run dev         # http://localhost:4000/graphql
```

Demo logins (password `password123`): `buyer@tredella.com`, `admin@tredella.com`.

## Switching to PostgreSQL

1. In `prisma/schema.prisma` set `provider = "postgresql"`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. `npm run db:push && npm run db:seed`.

The schema intentionally avoids SQLite-only or Postgres-only features
(string-validated enums in `src/lib/constants.ts`), so no other changes are needed.

## Deploying to Vercel

The repo ships a serverless entry (`api/index.ts`) and `vercel.json`, so
importing this repo into Vercel works with no extra config.

**Environment variables to set in Vercel → Settings → Environment Variables:**

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A hosted PostgreSQL URL (Prisma Postgres, Neon, Supabase…). A `localhost` URL cannot be reached from Vercel. |
| `JWT_SECRET` | Any long random string |
| `CORS_ORIGINS` | `https://buyer-tredella.vercel.app,https://www.buyer-tredella.vercel.app,https://buyer-tredella-*.vercel.app` |
| `APP_URL` | `https://buyer-tredella.vercel.app` |
| `API_URL` | This API's own deployed URL |
| `SMTP_HOST` / `USER_EMAIL` / `SMTP_PASS` / `SMTP_FROM` | For password-reset email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional, for Google sign-in |

After the first deploy, push the schema and seed once against the hosted
database (run locally with `DATABASE_URL` pointing at it):

```bash
npx prisma db push
npm run db:seed
```

Then point the frontend at it: set `NEXT_PUBLIC_GRAPHQL_URL` to
`https://<this-api>/graphql` in the buyer-tredella Vercel project.

Also add `https://<this-api>/auth/google/callback` as an authorized redirect
URI in the Google Cloud console.

### What serverless cannot do

Vercel functions are short-lived and have a read-only filesystem, so two
features degrade automatically rather than break:

- **Real-time chat/notifications** — WebSocket subscriptions need a persistent
  connection. Messages still send and load, they just don't stream live.
  `/health` reports `realtime: false` there.
- **Review photo uploads** — `/upload/review-images` returns a clear 503.
  Wire up S3 or Cloudinary in `src/uploads.ts` to enable them.

Deploy to a persistent host (Railway, Render, Fly) instead if you need both.

## Architecture notes

- **Pricing security** — `src/lib/pricing.ts` is the only price source.
  `createOrder` recalculates every line from DB tiers; client prices are ignored.
- **Multi-vendor orders** — one checkout creates a main `Order` plus one
  `SellerOrder` per seller (independent status, future commissions/payouts).
- **Reviews** — only for `COMPLETED` order items, one per item, enforced server-side.
- **Chat** — `BUYER_SELLER`, `BUYER_ADMIN`, `SELLER_ADMIN` conversation types;
  real-time via GraphQL subscriptions over WebSocket.
- **Dynamic filters** — product attributes power category-specific facets;
  nothing category-specific is hardcoded in the frontend.
