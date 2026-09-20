import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SellerAccount } from './models/seller-account.model';
import { SellerVerificationInput } from './dto/seller-verification.input';
import { SellerAccountService } from './seller-account.service';
import { SellerDocumentType } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../auth/token.service';

/* Everything here is the seller's own registration data, so the whole resolver
   is behind SELLER. Files arrive over REST (see uploads/), not GraphQL. */
@Resolver(() => SellerAccount)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('SELLER')
export class SellerAccountResolver {
  constructor(private readonly account: SellerAccountService) {}

  @Query(() => SellerAccount, {
    description: "The signed-in seller's own store, including KYC state",
  })
  mySellerAccount(@CurrentUser() user: JwtPayload): Promise<SellerAccount> {
    return this.account.getMyAccount(user.userId);
  }

  @Mutation(() => SellerAccount, {
    description:
      'Saves the trade-registration details and puts the store in the review queue',
  })
  submitSellerVerification(
    @CurrentUser() user: JwtPayload,
    @Args('input') input: SellerVerificationInput,
  ): Promise<SellerAccount> {
    return this.account.submitVerification(user.userId, input);
  }

  @Mutation(() => Boolean, {
    description: 'Removes an uploaded document so it can be replaced',
  })
  removeSellerDocument(
    @CurrentUser() user: JwtPayload,
    @Args('type', { type: () => SellerDocumentType })
    type: SellerDocumentType,
  ): Promise<boolean> {
    return this.account.removeDocument(user.userId, type);
  }
}
