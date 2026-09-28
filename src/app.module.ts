import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import type { Request } from 'express';

import { PrismaModule } from './prisma/prisma.module';
import { PubSubModule } from './common/pubsub/pubsub.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { TokenModule } from './auth/token.module';
import { TokenService } from './auth/token.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { SellersModule } from './sellers/sellers.module';
import { BillingModule } from './billing/billing.module';
import { ReviewsModule } from './reviews/reviews.module';
import { QuestionsModule } from './questions/questions.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { OrdersModule } from './orders/orders.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthModule } from './health/health.module';
import type { GqlContext } from './common/graphql-context';

/* The shapes @nestjs/graphql hands the context factory: an HTTP request, or a
   graphql-ws connection whose caller was resolved in `onConnect`. */
type ContextArg = {
  req?: Request;
  connectionParams?: Record<string, unknown>;
  extra?: { user?: GqlContext['user']; connectionParams?: Record<string, unknown> };
};

const headerFrom = (params?: Record<string, unknown>): string | undefined => {
  const value = params?.authorization ?? params?.Authorization;
  return typeof value === 'string' ? value : undefined;
};

const buildContext = (tokens: TokenService, ctx: ContextArg): GqlContext => {
  if (ctx?.req)
    return {
      user: tokens.fromAuthHeader(ctx.req.headers.authorization),
      req: ctx.req,
    };

  // WebSocket: resolved once at connect time, reused for every operation
  if (ctx?.extra && 'user' in ctx.extra)
    return { user: ctx.extra.user ?? null };

  const header = headerFrom(ctx?.connectionParams ?? ctx?.extra?.connectionParams);
  return { user: tokens.fromAuthHeader(header) };
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    PrismaModule,
    PubSubModule,
    StorageModule,
    TokenModule,
    MailModule,

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [TokenModule],
      inject: [TokenService],
      useFactory: (
        tokens: TokenService,
      ): Omit<ApolloDriverConfig, 'driver'> => ({
        /* Built in memory, never written to disk. The committed schema.gql is
           produced solely by `npm run schema:generate`, so a stray `git diff` on
           it always means the API contract really changed — running the server
           used to rewrite the same file in a different format and show a
           phantom diff. (It also suits a read-only serverless filesystem.) */
        autoSchemaFile: true,
        sortSchema: false,
        introspection: true,
        context: (ctx: ContextArg): GqlContext => buildContext(tokens, ctx),
        subscriptions: {
          'graphql-ws': {
            // resolve the caller once per socket, not per operation
            onConnect: (context) => {
              const extra = context.extra as { user?: GqlContext['user'] };
              extra.user = tokens.fromAuthHeader(
                headerFrom(context.connectionParams),
              );
            },
          },
        },
      }),
    }),

    AuthModule,

    AdminModule,
    UsersModule,
    CatalogModule,
    SellersModule,
    BillingModule,
    ReviewsModule,
    QuestionsModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    ChatModule,
    NotificationsModule,
    UploadsModule,
    HealthModule,
  ],
})
export class AppModule {}
