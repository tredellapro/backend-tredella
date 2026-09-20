import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Plan as PrismaPlan, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from './payment-provider';
import { PLAN_CATALOGUE } from './plan-catalogue';
import { BillingInterval } from '../common/enums';
import { badInput, forbidden } from '../common/errors';
import { round2 } from '../common/pricing';

const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = {
  [BillingInterval.MONTHLY]: 1,
  [BillingInterval.QUARTERLY]: 3,
};

/**
 * Adds whole months without rolling into the next one: 31 Jan + 1 month is
 * 28 Feb, not 3 March, so a subscription bought at month-end keeps its date.
 */
export const addMonths = (from: Date, months: number): Date => {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(from.getUTCDate(), lastDay),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
    ),
  );
};

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentProvider,
  ) {}

  /* Plans are reference data, not demo data, so a fresh deploy must have them
     without anyone remembering to run the seed. Only fills an empty table —
     prices an admin has edited are never overwritten. */
  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.plan.count();
    if (existing > 0) return;
    await this.syncCatalogue();
    this.logger.log(`Seeded ${PLAN_CATALOGUE.length} subscription plans.`);
  }

  /* ---------------- plans ---------------- */

  listPlans(): Promise<PrismaPlan[]> {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { features: { orderBy: { position: 'asc' } } },
    });
  }

  priceFor(plan: PrismaPlan, interval: BillingInterval): number {
    return interval === BillingInterval.QUARTERLY
      ? plan.quarterlyPrice
      : plan.monthlyPrice;
  }

  /**
   * Writes the catalogue into the database, leaving prices an admin has since
   * changed alone — only features are rewritten, because they are positional.
   */
  async syncCatalogue(): Promise<void> {
    for (const seed of PLAN_CATALOGUE) {
      const plan = await this.prisma.plan.upsert({
        where: { code: seed.code },
        create: {
          code: seed.code,
          name: seed.name,
          tagline: seed.tagline,
          monthlyPrice: seed.monthlyPrice,
          quarterlyPrice: seed.quarterlyPrice,
          sortOrder: seed.sortOrder,
        },
        update: { name: seed.name, tagline: seed.tagline, sortOrder: seed.sortOrder },
      });

      await this.prisma.planFeature.deleteMany({ where: { planId: plan.id } });
      await this.prisma.planFeature.createMany({
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

  /* ---------------- subscription ---------------- */

  private async sellerOf(userId: string): Promise<{ id: string; email: string }> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!seller)
      throw forbidden('This account does not have a seller store attached.');
    return { id: seller.id, email: seller.user?.email ?? '' };
  }

  getMySubscription(userId: string): Promise<Subscription | null> {
    return this.prisma.seller
      .findUnique({ where: { userId } })
      .subscription({
        include: {
          plan: { include: { features: { orderBy: { position: 'asc' } } } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
  }

  /**
   * Choosing a plan. The provider decides whether money is owed; while none is
   * connected the plan goes live immediately and the period is recorded WAIVED,
   * so the ledger does not begin mid-history once a gateway arrives.
   */
  async subscribe(
    userId: string,
    planCode: string,
    interval: BillingInterval,
  ): Promise<{
    subscription: Subscription;
    checkoutUrl: string | null;
    activated: boolean;
  }> {
    const seller = await this.sellerOf(userId);

    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });
    if (!plan || !plan.active) throw badInput('That plan is not available.');

    const amount = round2(this.priceFor(plan, interval));
    const existing = await this.prisma.subscription.findUnique({
      where: { sellerId: seller.id },
    });

    if (
      existing?.status === 'ACTIVE' &&
      existing.planId === plan.id &&
      existing.interval === interval
    )
      throw badInput('You are already on this plan.');

    const checkout = await this.payments.startCheckout({
      sellerId: seller.id,
      sellerEmail: seller.email,
      plan,
      interval,
      amount,
      currency: plan.currency,
    });

    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, MONTHS_PER_INTERVAL[interval]);

    /* Until the gateway confirms payment the plan is not live, so a provider
       that returns a checkout URL leaves the subscription PAST_DUE and its
       webhook flips it to ACTIVE. */
    const status = checkout.activatedImmediately ? 'ACTIVE' : 'PAST_DUE';

    const subscription = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.subscription.upsert({
        where: { sellerId: seller.id },
        create: {
          sellerId: seller.id,
          planId: plan.id,
          interval,
          amount,
          currency: plan.currency,
          status,
          autoRenew: true,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          provider: this.payments.name,
          providerCustomerId: checkout.providerCustomerId ?? null,
          providerSubscriptionId: checkout.providerSubscriptionId ?? null,
        },
        update: {
          planId: plan.id,
          interval,
          amount,
          currency: plan.currency,
          status,
          autoRenew: true,
          cancelledAt: null,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          provider: this.payments.name,
          providerCustomerId: checkout.providerCustomerId ?? null,
          providerSubscriptionId: checkout.providerSubscriptionId ?? null,
        },
      });

      await tx.payment.create({
        data: {
          subscriptionId: saved.id,
          amount,
          currency: plan.currency,
          status: checkout.activatedImmediately ? 'WAIVED' : 'PENDING',
          periodStart,
          periodEnd,
          provider: this.payments.name,
          paidAt: checkout.activatedImmediately ? periodStart : null,
        },
      });

      return saved;
    });

    return {
      subscription: await this.reload(subscription.id),
      checkoutUrl: checkout.checkoutUrl,
      activated: checkout.activatedImmediately,
    };
  }

  /** Stops renewal but leaves the plan usable to the end of the paid period. */
  async cancel(userId: string): Promise<Subscription> {
    const seller = await this.sellerOf(userId);
    const existing = await this.prisma.subscription.findUnique({
      where: { sellerId: seller.id },
    });
    if (!existing) throw badInput('You do not have a subscription to cancel.');
    if (existing.status === 'CANCELLED')
      throw badInput('That subscription is already cancelled.');

    await this.payments.cancel(existing.providerSubscriptionId);

    const updated = await this.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });
    return this.reload(updated.id);
  }

  private reload(id: string): Promise<Subscription> {
    return this.prisma.subscription.findUniqueOrThrow({
      where: { id },
      include: {
        plan: { include: { features: { orderBy: { position: 'asc' } } } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
