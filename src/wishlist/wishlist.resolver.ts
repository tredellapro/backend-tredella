import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  Product as PrismaProduct,
  WishlistItem as PrismaWishlistItem,
} from '@prisma/client';
import { WishlistItem } from './models/wishlist-item.model';
import { Product } from '../catalog/models/product.model';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mode } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => WishlistItem)
export class WishlistResolver {
  constructor(
    private readonly wishlist: WishlistService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [WishlistItem])
  @UseGuards(GqlAuthGuard)
  getWishlist(
    @CurrentUser() user: JwtPayload,
    @Args('mode', { type: () => Mode, nullable: true }) mode?: Mode | null,
  ): Promise<PrismaWishlistItem[]> {
    return this.wishlist.list(user.userId, mode);
  }

  @Mutation(() => WishlistItem, {
    description:
      'Pass either productId or productSlug — the slug is the stable public key',
  })
  @UseGuards(GqlAuthGuard)
  addToWishlist(
    @CurrentUser() user: JwtPayload,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('productId', { type: () => ID, nullable: true })
    productId?: string | null,
    @Args('productSlug', { type: () => String, nullable: true })
    productSlug?: string | null,
  ): Promise<PrismaWishlistItem> {
    return this.wishlist.add(user.userId, { productId, productSlug }, mode);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  removeFromWishlist(
    @CurrentUser() user: JwtPayload,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('productId', { type: () => ID, nullable: true })
    productId?: string | null,
    @Args('productSlug', { type: () => String, nullable: true })
    productSlug?: string | null,
  ): Promise<boolean> {
    return this.wishlist.remove(user.userId, { productId, productSlug }, mode);
  }

  @ResolveField(() => Product)
  product(@Parent() item: PrismaWishlistItem): Promise<PrismaProduct> {
    return this.prisma.wishlistItem
      .findUnique({ where: { id: item.id } })
      .product() as Promise<PrismaProduct>;
  }
}
