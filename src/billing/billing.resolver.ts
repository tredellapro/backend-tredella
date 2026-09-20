import { UseGuards } from '@nestjs/common';
import {
  Args,
  Float,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { Plan as PrismaPlan } from '@prisma/client';
import { Plan } from './models/plan.model';
import {
  CheckoutSession,
  SellerSubscription,
} from './models/subscription.model';
import { BillingService } from './billing.service';
import { BillingInterval } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => Plan)
export class PlansResolver {
  constructor(private readonly billing: BillingService) {}

  /** Public: the pricing page is shown before anyone signs up. */
  @Query(() => [Plan], { description: 'Seller subscription tiers, cheapest first' })
  getPlans(): Promise<PrismaPlan[]> {
    return this.billing.listPlans();
  }

  /* Saves every client repeating the monthly/quarterly branch — and keeps the
     discount rule in one place. */
  @ResolveField(() => Float)
  price(
    @Parent() plan: PrismaPlan,
    @Args('interval', {
      type: () => BillingInterval,
      defaultValue: BillingInterval.MONTHLY,
    })
    interval: BillingInterval,
  ): number {
    return this.billing.priceFor(plan, interval);
  }
}

@Resolver(() => SellerSubscription)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('SELLER')
export class SubscriptionResolver {
  constructor(private readonly billing: BillingService) {}

  @Query(() => SellerSubscription, {
    nullable: true,
    description: "The seller's current plan, or null if they skipped",
  })
  mySubscription(@CurrentUser() user: JwtPayload): Promise<SellerSubscription | null> {
    return this.billing.getMySubscription(user.userId) as Promise<SellerSubscription | null>;
  }

  @Mutation(() => CheckoutSession, {
    description:
      'Choose a plan. Redirect to checkoutUrl when it is set; when null the plan is already active.',
  })
  async subscribeToPlan(
    @CurrentUser() user: JwtPayload,
    @Args('planCode') planCode: string,
    @Args('interval', { type: () => BillingInterval }) interval: BillingInterval,
  ): Promise<CheckoutSession> {
    const result = await this.billing.subscribe(user.userId, planCode, interval);
    return {
      subscription: result.subscription as unknown as SellerSubscription,
      checkoutUrl: result.checkoutUrl,
      activated: result.activated,
    };
  }

  @Mutation(() => SellerSubscription, {
    description: 'Stop renewal; the plan stays usable until the period ends',
  })
  async cancelSubscription(
    @CurrentUser() user: JwtPayload,
  ): Promise<SellerSubscription> {
    const cancelled = await this.billing.cancel(user.userId);
    return cancelled as unknown as SellerSubscription;
  }
}
