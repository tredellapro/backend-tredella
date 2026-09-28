import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Product as PrismaProduct } from '@prisma/client';
import { Product } from '../catalog/models/product.model';
import { AdminProductsService } from './admin-products.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalStatus } from './approval-status.enum';
import type { JwtPayload } from '../auth/token.service';

/**
 * Everything here is ADMIN-only and deliberately unscoped — the whole point of
 * the console is seeing what no single buyer or seller can. The guard is the
 * boundary; the admin app's own permission map only shapes its UI.
 */
@Resolver()
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminResolver {
  constructor(private readonly products: AdminProductsService) {}

  @Query(() => [Product], {
    description:
      'Every listing, including the ones buyers cannot see. Unreviewed first.',
  })
  adminProducts(
    @Args('status', { type: () => ApprovalStatus, nullable: true })
    status?: ApprovalStatus | null,
    @Args('sellerId', { type: () => ID, nullable: true })
    sellerId?: string | null,
    @Args('search', { type: () => String, nullable: true })
    search?: string | null,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page?: number | null,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 })
    pageSize?: number | null,
  ): Promise<PrismaProduct[]> {
    return this.products.list({ status, sellerId, search, page, pageSize });
  }

  @Query(() => Int, {
    description: 'Listings waiting on a decision — drives the review badge.',
  })
  adminProductsAwaitingReview(): Promise<number> {
    return this.products.countAwaitingReview();
  }

  @Mutation(() => Product, {
    description:
      'Approve or reject a listing. Approving clears it for sale; it does not change what the seller chose to offer.',
  })
  reviewProduct(
    @CurrentUser() user: JwtPayload,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('status', { type: () => ApprovalStatus }) status: ApprovalStatus,
    @Args('note', { type: () => String, nullable: true })
    note?: string | null,
  ): Promise<PrismaProduct> {
    return this.products.review(user.userId, productId, status, note);
  }
}
