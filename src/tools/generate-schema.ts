import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthResolver } from '../auth/auth.resolver';
import { UsersResolver } from '../users/users.resolver';
import {
  CategoriesResolver,
  SubcategoriesResolver,
} from '../catalog/categories.resolver';
import { ProductsResolver } from '../catalog/products.resolver';
import { SellersResolver } from '../sellers/sellers.resolver';
import { SellerAccountResolver } from '../sellers/seller-account.resolver';
import {
  PlansResolver,
  SubscriptionResolver,
} from '../billing/billing.resolver';
import { ReviewsResolver } from '../reviews/reviews.resolver';
import { QuestionsResolver } from '../questions/questions.resolver';
import { CartResolver } from '../cart/cart.resolver';
import { WishlistResolver } from '../wishlist/wishlist.resolver';
import {
  OrderItemsResolver,
  OrdersResolver,
  SellerOrdersResolver,
} from '../orders/orders.resolver';
import {
  ConversationsResolver,
  MessagesResolver,
} from '../chat/chat.resolver';
import { NotificationsResolver } from '../notifications/notifications.resolver';
import { AdminResolver } from '../admin/admin.resolver';
import { AdminSellersResolver } from '../admin/admin-sellers.resolver';

/* Prints the generated SDL without booting the app (so no database is needed).
 * Run it in CI to catch accidental schema changes:
 *   npm run build && node dist/tools/generate-schema.js schema.gql
 */

export const RESOLVERS = [
  /* A resolver left out of this list is silently missing from the committed
     schema.gql, which is the contract all three front ends read against. */
  AdminResolver,
  AdminSellersResolver,
  AuthResolver,
  UsersResolver,
  CategoriesResolver,
  SubcategoriesResolver,
  ProductsResolver,
  SellersResolver,
  SellerAccountResolver,
  PlansResolver,
  SubscriptionResolver,
  ReviewsResolver,
  QuestionsResolver,
  CartResolver,
  WishlistResolver,
  OrdersResolver,
  SellerOrdersResolver,
  OrderItemsResolver,
  ConversationsResolver,
  MessagesResolver,
  NotificationsResolver,
];

async function main(): Promise<void> {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, {
    logger: false,
  });
  await app.init();

  const schemaFactory = app.get(GraphQLSchemaFactory);
  const schema = await schemaFactory.create(RESOLVERS);
  const sdl = printSchema(schema);

  const target = process.argv[2];
  if (target) {
    const out = join(process.cwd(), target);
    writeFileSync(out, `${sdl}\n`, 'utf8');
    process.stdout.write(`schema written to ${out}\n`);
  } else {
    process.stdout.write(sdl);
  }

  await app.close();
}

void main();
