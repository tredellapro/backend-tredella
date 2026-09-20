/* Creates the demo seller the dashboard's "Preview with demo account" button
   signs in as.
 *
 * Unlike seed.ts this is additive — it upserts and clears nothing, so it is
 * safe to run against a database that already has real data.
 *
 *   npm run db:demo
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PLAN_CATALOGUE } from '../src/billing/plan-catalogue';

const prisma = new PrismaClient();

export const DEMO_EMAIL = 'demo@tredella.com';
export const DEMO_PASSWORD = 'demo1234';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Plans normally seed themselves on API boot; do it here so a standalone run works. */
async function ensurePlans() {
  for (const seed of PLAN_CATALOGUE) {
    const plan = await prisma.plan.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        tagline: seed.tagline,
        monthlyPrice: seed.monthlyPrice,
        quarterlyPrice: seed.quarterlyPrice,
        sortOrder: seed.sortOrder,
      },
      update: {},
    });
    const existing = await prisma.planFeature.count({ where: { planId: plan.id } });
    if (existing > 0) continue;
    await prisma.planFeature.createMany({
      data: seed.features.map((feature, position) => ({
        planId: plan.id,
        kind: feature.kind,
        title: feature.title ?? null,
        label: feature.label,
        included: feature.included ?? true,
        position,
      })),
    });
  }
}

async function main() {
  await ensurePlans();

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: 'Electronics Store',
      password,
      role: 'SELLER',
    },
    // rerunning must restore the account, not just leave whatever is there
    update: { password, role: 'SELLER', name: 'Electronics Store' },
  });

  const existingStore = await prisma.seller.findUnique({
    where: { userId: user.id },
  });

  /* Approved and verified: the point is to look at the dashboard, not to walk
     the registration gates again. */
  const storeData = {
    name: 'Electronics Store',
    description: 'Consumer electronics, wholesale and retail.',
    verified: true,
    legalName: 'Electronics Store Trading LLC',
    legalForm: 'LLC',
    emirate: 'DUBAI',
    addressLine: 'Office 1204, Business Bay, Dubai',
    phone: '+971501234567',
    tradeLicenseNumber: 'CN-2956412',
    tradeLicenseExpiry: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 31)),
    emiratesIdNumber: '784199012345671',
    verificationStatus: 'APPROVED',
    submittedAt: new Date(Date.now() - 30 * DAY),
    reviewedAt: new Date(Date.now() - 28 * DAY),
    shipsFrom: 'Dubai, UAE',
  };

  const store = existingStore
    ? await prisma.seller.update({
        where: { id: existingStore.id },
        data: storeData,
      })
    : await prisma.seller.create({
        data: { ...storeData, slug: 'electronics-store', userId: user.id },
      });

  const plan = await prisma.plan.findUnique({ where: { code: 'STANDARD' } });
  if (plan) {
    const start = new Date(Date.now() - 10 * DAY);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    await prisma.subscription.upsert({
      where: { sellerId: store.id },
      create: {
        sellerId: store.id,
        planId: plan.id,
        interval: 'MONTHLY',
        amount: plan.monthlyPrice,
        currency: plan.currency,
        status: 'ACTIVE',
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
    });
  }

  // replaced wholesale, so reruns do not stack duplicates
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  const now = Date.now();
  const notifications = [
    {
      type: 'PRODUCT_APPROVED',
      title: 'Product Approved',
      body: 'Your product "Wireless Earbuds" has been approved.',
      link: '/dashboard/notifications',
      createdAt: new Date(now - 5 * MINUTE),
    },
    {
      type: 'DELIVERY_UPDATE',
      title: 'Order Delivered',
      body: 'Order #1023 has been successfully delivered.',
      link: '/dashboard/notifications',
      createdAt: new Date(now - 2 * HOUR),
    },
    {
      type: 'PROMOTION',
      title: 'New Promotion',
      body: 'Get 20% off on featured products!',
      createdAt: new Date(now - 6 * HOUR),
    },
    {
      type: 'PRODUCT_APPROVED',
      title: 'Product Approved',
      body: 'Your product "Bluetooth Speaker" has been approved.',
      createdAt: new Date(now - 3 * DAY),
    },
    {
      type: 'ORDER_UPDATE',
      title: 'New order received',
      body: 'Order #1044 for 250 items is awaiting confirmation.',
      createdAt: new Date(now - 20 * DAY),
      readAt: new Date(now - 19 * DAY),
    },
  ];
  for (const data of notifications)
    await prisma.notification.create({ data: { userId: user.id, ...data } });

  console.log(`Demo seller ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Store "${store.name}" (${store.slug}) — ${store.verificationStatus}`);
  console.log(`${notifications.length} notifications seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
