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
