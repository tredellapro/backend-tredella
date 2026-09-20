# backend-tredella

GraphQL API for the Tredella multi-vendor marketplace (retail + wholesale, AED).
Consumed by the Next.js buyer website today, the seller and admin dashboards
next, and a React Native app later — all business rules (tier pricing, stock,
review eligibility, order splitting) live here, never in the frontend.

## Stack

- **NestJS 11** + TypeScript (modular, DI, guards)
- **GraphQL code-first** via `@nestjs/graphql` + Apollo Server 5
- `graphql-ws` subscriptions (chat, notifications)
- **Prisma ORM** → PostgreSQL
- JWT auth with BUYER / SELLER / ADMIN roles

## Quick start

```bash
npm install
npm run db:push     # push the schema to DATABASE_URL
npm run db:seed     # 56 products, 4 sellers, demo users
npm run dev         # http://localhost:4000/graphql
```

Demo logins (password `password123`): `buyer@tredella.com`, `admin@tredella.com`.

For the seller dashboard, add a preview seller — an approved store on a plan,
with notifications to look at:

```bash
npm run db:demo     # demo@tredella.com / demo1234
```

Unlike `db:seed` this clears nothing, so it is safe to run against a database
that already has real data. The seller app's login page shows a
"Preview with demo account" button in development that signs in as it.

Copy `.env.example` to `.env` first — `DATABASE_URL` and `JWT_SECRET` are required.

## Project layout

Each domain is a Nest module owning its models, service and resolvers:

```
src/
  main.ts                 bootstrap: CORS, body limit, static /uploads
  app.module.ts           root module + GraphQL driver and context
  schema.gql              generated SDL (also written to /schema.gql)

  prisma/                 PrismaService (global)
  common/                 enums, errors, pricing, pagination, guards, decorators
  auth/                   login/register/reset + JWT + OAuth controller
  users/                  me, addresses
  catalog/                categories, products, search, facets
  sellers/                storefronts
  cart/  wishlist/  orders/
  reviews/  questions/
  chat/                   conversations, messages, subscriptions
  notifications/
  uploads/                review photo endpoint (REST — multipart)
  health/                 GET / and /health
  tools/generate-schema   prints the SDL without booting the app
```

### Conventions

- **Auth** — the GraphQL context resolves the caller once per request (or once
  per socket on connect). `@UseGuards(GqlAuthGuard)` requires a signed-in user;
  `@Roles('SELLER')` + `RolesGuard` restricts by role. Read the caller with
  `@CurrentUser()`.
- **Errors** — `badInput` / `unauthenticated` / `forbidden` in
  `src/common/errors.ts` produce the `BAD_USER_INPUT`, `UNAUTHENTICATED` and
  `FORBIDDEN` extension codes the web clients branch on.
- **Timestamps** — exposed as ISO `String` via the `isoDate` field middleware,
  not a Date scalar.

### Schema stability

`schema.gql` is generated, committed, and must stay in step with the clients:

```bash
npm run schema:generate     # rebuilds and rewrites schema.gql
```

It runs without a database, so it is safe in CI — fail the build if
`git diff --exit-code schema.gql` reports a change you did not intend.

## Deploying to Vercel

The repo ships a serverless entry (`api/index.js`) and `vercel.json`.
`api/index.js` is deliberately plain JavaScript that loads the **compiled**
app from `dist/`: Vercel transpiles `api/` with esbuild, which does not emit
the decorator metadata Nest's dependency injection needs, while
`npm run build` (tsc) does.

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
  Wire up S3 or Cloudinary in `src/uploads/` to enable them.

Deploy to a persistent host (Railway, Render, Fly) instead if you need both.

## Architecture notes

- **Pricing security** — `src/common/pricing.ts` is the only price source.
  `createOrder` recalculates every line from DB tiers; client prices are ignored.
- **Multi-vendor orders** — one checkout creates a main `Order` plus one
  `SellerOrder` per seller (independent status, future commissions/payouts).
- **Reviews** — only for `COMPLETED` order items, one per item, enforced server-side.
- **Chat** — `BUYER_SELLER`, `BUYER_ADMIN`, `SELLER_ADMIN` conversation types;
  real-time via GraphQL subscriptions over WebSocket.
- **One login, scoped per app** — `login(…, requireRole: SELLER)` rejects an
  account that does not hold that role, so a buyer cannot reach the seller
  dashboard and vice versa. Omitting `requireRole` keeps the buyer site's
  behaviour unchanged.
- **Two password-reset routes to the same door** — the buyer site emails a link
  (`requestPasswordReset` → `/reset-password?token=…`); the dashboards email a
  6-digit code (`requestPasswordResetCode` → `verifyPasswordResetCode`), which
  exchanges the code for a token. Both end at the same `resetPassword` mutation.
  The code path deliberately carries no URL, so one `APP_URL` cannot point the
  mail at the wrong app. Codes are HMAC-keyed with the server secret (a plain
  digest of a million possibilities would not survive a leaked table), expire in
  15 minutes, are single-use, and lock out after 5 wrong attempts.
- **Seller signup** — `registerSeller` creates the `User` (role SELLER) and its
  `Seller` storefront in one transaction, deriving a unique slug from the store
  name and mapping the chosen country to `Seller.shipsFrom`.
- **UAE trade registration** — a seller uploads their trade licence and Emirates
  ID (plus a VAT certificate if they hold a TRN), then `submitSellerVerification`
  validates the details and moves the store to `PENDING`. `Seller.verified` only
  turns true when a reviewer approves. Registration data lives on a separate
  `SellerAccount` type behind `@Roles('SELLER')` — the public `Seller` type a
  shopper can query exposes none of it.
- **Plans and subscriptions** — two tiers (AED 150 and AED 200 a month; quarterly
  is the three-month total less 10%, so 405 and 540). Prices live in the `Plan`
  table, not in the apps, and are seeded on first boot when the table is empty.
  `Plan.price(interval:)` returns the figure for a period so no client repeats
  the discount rule.
- **No payment gateway yet** — the client picks the bank once the product is
  done, so `PaymentProvider` is a one-method seam with `FreePaymentProvider`
  bound in `BillingModule`. Choosing a plan activates it immediately and the
  period is recorded as a `WAIVED` payment, which keeps the ledger continuous
  rather than starting the day a card is first charged. `subscribeToPlan`
  already returns `checkoutUrl`; a real provider fills it with a hosted payment
  page and leaves the subscription `PAST_DUE` until its webhook confirms. Adding
  a gateway means writing one class and swapping one binding.
- **File storage** — `StorageService` picks Cloudinary when `CLOUDINARY_URL` is
  set and local disk otherwise, so uploads keep working on a serverless host.
  `/upload/seller-document` takes PDFs as well as images (licences are usually
  PDFs) and caps files at 4MB to stay under Vercel's request limit.
- **Dynamic filters** — product attributes power category-specific facets;
  nothing category-specific is hardcoded in the frontend.
- **String "enums"** — order/conversation/notification statuses are validated
  strings (`src/common/constants.ts`) rather than native DB enums, so the schema
  stays portable. `Mode` and `SortBy` are real GraphQL enums at the API edge.
