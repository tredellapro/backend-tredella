import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import {
  BillingInterval,
  PaymentStatus,
  SubscriptionStatus,
} from '../../common/enums';
import { Plan } from './plan.model';

@ObjectType({ description: "One billing period's charge." })
export class Payment {
  @Field(() => ID)
  id!: string;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => PaymentStatus)
  status!: PaymentStatus;

  @Field(() => String, { middleware: [isoDate] })
  periodStart!: Date;

  @Field(() => String, { middleware: [isoDate] })
  periodEnd!: Date;

  @Field({ description: 'FREE until a gateway is connected' })
  provider!: string;

  @Field(() => String, { nullable: true })
  failureReason!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  paidAt!: Date | null;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;
}

@ObjectType({
  description: "A seller's plan. Named apart from GraphQL's root Subscription type.",
})
export class SellerSubscription {
  @Field(() => ID)
  id!: string;

  @Field(() => Plan)
  plan!: Plan;

  @Field(() => BillingInterval)
  interval!: BillingInterval;

  @Field(() => Float, { description: 'AED charged each period' })
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => SubscriptionStatus)
  status!: SubscriptionStatus;

  @Field()
  autoRenew!: boolean;

  @Field(() => String, { middleware: [isoDate] })
  currentPeriodStart!: Date;

  @Field(() => String, { middleware: [isoDate] })
  currentPeriodEnd!: Date;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  cancelledAt!: Date | null;

  @Field({ description: 'FREE until a gateway is connected' })
  provider!: string;

  @Field(() => [Payment])
  payments!: Payment[];
}

@ObjectType({
  description: 'Result of choosing a plan. Follow checkoutUrl when it is set.',
})
export class CheckoutSession {
  @Field(() => SellerSubscription)
  subscription!: SellerSubscription;

  @Field(() => String, {
    nullable: true,
    description:
      'Hosted payment page to redirect to. Null while no gateway is connected — the plan is already active.',
  })
  checkoutUrl!: string | null;

  @Field({
    description: 'True when nothing is owed and the plan is live right away',
  })
  activated!: boolean;
}
