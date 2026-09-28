import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type {
  Product as PrismaProduct,
  Question as PrismaQuestion,
  User as PrismaUser,
} from '@prisma/client';
import { Question } from './models/question.model';
import { PublicUser } from '../users/models/public-user.model';
import { Product } from '../catalog/models/product.model';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => Question)
export class QuestionsResolver {
  constructor(
    private readonly questions: QuestionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [Question])
  getProductQuestions(
    @Args('productId', { type: () => ID }) productId: string,
  ): Promise<PrismaQuestion[]> {
    return this.questions.listForProduct(productId);
  }

  /** The seller's own queue, across every product they list. */
  @Query(() => [Question])
  @UseGuards(GqlAuthGuard)
  mySellerQuestions(
    @CurrentUser() user: JwtPayload,
    @Args('answered', { type: () => Boolean, nullable: true })
    answered?: boolean | null,
  ): Promise<PrismaQuestion[]> {
    return this.questions.listForSeller(user.userId, answered);
  }

  @Mutation(() => Question)
  @UseGuards(GqlAuthGuard)
  askProductQuestion(
    @CurrentUser() user: JwtPayload,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('text') text: string,
  ): Promise<PrismaQuestion> {
    return this.questions.ask(user.userId, productId, text);
  }

  @Mutation(() => Question)
  @UseGuards(GqlAuthGuard)
  answerProductQuestion(
    @CurrentUser() user: JwtPayload,
    @Args('questionId', { type: () => ID }) questionId: string,
    @Args('answer') answer: string,
  ): Promise<PrismaQuestion> {
    return this.questions.answer(user.userId, questionId, answer);
  }

  @ResolveField(() => PublicUser)
  user(@Parent() question: PrismaQuestion): Promise<PrismaUser> {
    return this.prisma.question
      .findUnique({ where: { id: question.id } })
      .user() as Promise<PrismaUser>;
  }

  @ResolveField(() => Product)
  product(@Parent() question: PrismaQuestion): Promise<PrismaProduct> {
    return this.prisma.question
      .findUnique({ where: { id: question.id } })
      .product() as Promise<PrismaProduct>;
  }
}
