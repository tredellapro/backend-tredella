import { Injectable, Logger } from '@nestjs/common';
import type { Plan } from '@prisma/client';
import type { BillingInterval } from '../common/enums';

/* The seam a payment gateway plugs into.
 *
 * No gateway is connected yet — the client chooses the bank once the product is
 * done — so FreePaymentProvider activates a subscription without charging. When
 * Stripe/Telr/PayTabs/N-Genius is picked, add a provider here and swap the
 * binding in BillingModule: nothing else in the app has to change, because the
 * callers only ever see `checkoutUrl`.
 *
 * `checkoutUrl` is null when there is nothing to pay. A real provider returns a
 * hosted payment page to redirect to, which is why card details never need to
 * reach this server.
 */

export type CheckoutRequest = {
  sellerId: string;
  sellerEmail: string;
  plan: Plan;
  interval: BillingInterval;
  /** AED to charge for one period. */
  amount: number;
  currency: string;
};

export type CheckoutResult = {
  /** Where to send the seller to pay, or null when the plan costs nothing now. */
  checkoutUrl: string | null;
  /** Gateway's own id for the subscription, stored for reconciliation. */
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  /** True when the seller is already entitled and no payment is outstanding. */
  activatedImmediately: boolean;
};

export abstract class PaymentProvider {
  /** Recorded on Subscription.provider — FREE, STRIPE, TELR, … */
  abstract readonly name: string;

  abstract startCheckout(_request: CheckoutRequest): Promise<CheckoutResult>;

  /** Stop future renewals at the gateway. */
  abstract cancel(_providerSubscriptionId: string | null): Promise<void>;
}

/**
 * Stand-in until a gateway is chosen: the seller gets the plan immediately and
 * the period is recorded as WAIVED, so the billing history is continuous rather
 * than starting the day a card is first charged.
 */
@Injectable()
export class FreePaymentProvider extends PaymentProvider {
  readonly name = 'FREE';
  private readonly logger = new Logger(FreePaymentProvider.name);

  startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    this.logger.log(
      `Activating ${request.plan.code} (${request.interval}) for seller ${request.sellerId} — no gateway connected, ${request.currency} ${request.amount} waived.`,
    );
    return Promise.resolve({
      checkoutUrl: null,
      providerSubscriptionId: null,
      providerCustomerId: null,
      activatedImmediately: true,
    });
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }
}
