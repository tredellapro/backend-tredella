import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PlansResolver, SubscriptionResolver } from './billing.resolver';
import { FreePaymentProvider, PaymentProvider } from './payment-provider';

/* One binding chooses the gateway. Swap FreePaymentProvider for a real driver
   once the client picks a bank — the service and resolvers do not change. */
@Module({
  providers: [
    BillingService,
    PlansResolver,
    SubscriptionResolver,
    { provide: PaymentProvider, useClass: FreePaymentProvider },
  ],
  exports: [BillingService],
})
export class BillingModule {}
