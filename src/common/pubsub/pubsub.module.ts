import { Global, Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

export const PUB_SUB = 'PUB_SUB';

/* In-memory PubSub is fine for a single instance; swap the provider for a
   Redis-backed engine when scaling horizontally (serverless has no long-lived
   connections, so subscriptions are simply unavailable there). */
@Global()
@Module({
  providers: [{ provide: PUB_SUB, useValue: new PubSub() }],
  exports: [PUB_SUB],
})
export class PubSubModule {}
