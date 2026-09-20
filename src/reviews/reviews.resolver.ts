import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  Review as PrismaReview,
  User as PrismaUser,
} from '@prisma/client';
import { Review, ReviewConnection } from './models/review.model';
import { PublicUser } from '../users/models/public-user.model';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => Review)
export class ReviewsResolver {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => ReviewConnection)
  getProductReviews(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page?: number | null,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 10 })
    pageSize?: number | null,
  ): Promise<ReviewConnection> {
    return this.reviews.listForProduct(productId, page, pageSize);
  }

  @Mutation(() => Review)
  @UseGuards(GqlAuthGuard)
  createReview(
    @CurrentUser() user: JwtPayload,
    @Args('orderItemId', { type: () => ID }) orderItemId: string,
    @Args('rating', { type: () => Int }) rating: number,
    @Args('text') text: string,
    @Args('images', { type: () => [String], nullable: true })
    images?: string[] | null,
  ): Promise<PrismaReview> {
    return this.reviews.create(user.userId, orderItemId, rating, text, images);
  }

  /** Photos are stored as one comma-separated column. */
  @ResolveField(() => [String])
  images(@Parent() review: PrismaReview): string[] {
    return review.images ? review.images.split(',').filter(Boolean) : [];
  }

  @ResolveField(() => PublicUser)
  user(@Parent() review: PrismaReview): Promise<PrismaUser> {
    return this.prisma.review
      .findUnique({ where: { id: review.id } })
      .user() as Promise<PrismaUser>;
  }
}
