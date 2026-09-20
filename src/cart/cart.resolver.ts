import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Cart, CartItem } from './models/cart.model';
import { CartService } from './cart.service';
import { Mode } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

/* Every cart read re-prices from the database, so the resolvers hand back the
   whole cart rather than the mutated line — the clients already expect that. */
@Resolver(() => CartItem)
@UseGuards(GqlAuthGuard)
export class CartResolver {
  constructor(private readonly cart: CartService) {}

  @Query(() => Cart)
  getCart(
    @CurrentUser() user: JwtPayload,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<Cart> {
    return this.cart.getCart(user.userId, mode);
  }

  @Mutation(() => Cart)
  addToCart(
    @CurrentUser() user: JwtPayload,
    @Args('quantity', { type: () => Int }) quantity: number,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('productId', { type: () => ID, nullable: true })
    productId?: string | null,
    @Args('productSlug', { type: () => String, nullable: true })
    productSlug?: string | null,
  ): Promise<Cart> {
    return this.cart.addToCart(
      user.userId,
      { productId, productSlug },
      quantity,
      mode,
    );
  }

  @Mutation(() => Cart)
  updateCartItem(
    @CurrentUser() user: JwtPayload,
    @Args('cartItemId', { type: () => ID }) cartItemId: string,
    @Args('quantity', { type: () => Int }) quantity: number,
  ): Promise<Cart> {
    return this.cart.updateCartItem(user.userId, cartItemId, quantity);
  }

  @Mutation(() => Cart)
  removeFromCart(
    @CurrentUser() user: JwtPayload,
    @Args('cartItemId', { type: () => ID }) cartItemId: string,
  ): Promise<Cart> {
    return this.cart.removeFromCart(user.userId, cartItemId);
  }
}
