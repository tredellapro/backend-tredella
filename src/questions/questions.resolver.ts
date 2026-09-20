import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { Question as PrismaQuestion, User as PrismaUser } from '@prisma/client';
import { Question } from './models/question.model';
import { PublicUser } from '../users/models/public-user.model';
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

  @Mutation(() => Question)
  @UseGuards(GqlAuthGuard)
  askProductQuestion(
    @CurrentUser() user: JwtPayload,
    @Args('productId', { type: () => ID }) productId: string,
    @Args('text') text: string,
  ): Promise<PrismaQuestion> {
    return this.questions.ask(user.userId, productId, text);
  }

  @ResolveField(() => PublicUser)
  user(@Parent() question: PrismaQuestion): Promise<PrismaUser> {
    return this.prisma.question
      .findUnique({ where: { id: question.id } })
      .user() as Promise<PrismaUser>;
  }
}
