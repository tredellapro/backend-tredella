import { registerEnumType } from '@nestjs/graphql';

/* Real GraphQL enums for the two values the clients switch on. The Prisma
   columns stay plain strings (portable schema), these guard the API edge. */

export enum Mode {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

registerEnumType(Mode, {
  name: 'Mode',
  description: 'Storefront the request applies to.',
});

export enum SortBy {
  RELEVANCE = 'RELEVANCE',
  NEWEST = 'NEWEST',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  BEST_RATED = 'BEST_RATED',
  MOST_POPULAR = 'MOST_POPULAR',
  LOWEST_WHOLESALE_PRICE = 'LOWEST_WHOLESALE_PRICE',
  BEST_BULK_DISCOUNT = 'BEST_BULK_DISCOUNT',
}

registerEnumType(SortBy, { name: 'SortBy' });
