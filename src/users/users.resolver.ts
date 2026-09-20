import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { Address as PrismaAddress, User as PrismaUser } from '@prisma/client';
import { User } from './models/user.model';
import { Address } from './models/address.model';
import { AddressInput } from './dto/address.input';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly users: UsersService) {}

  @Query(() => User, { nullable: true })
  me(@CurrentUser() user: JwtPayload | null): Promise<PrismaUser | null> {
    if (!user) return Promise.resolve(null);
    return this.users.findById(user.userId);
  }

  @Mutation(() => Address)
  @UseGuards(GqlAuthGuard)
  addAddress(
    @CurrentUser() user: JwtPayload,
    @Args('input') input: AddressInput,
  ): Promise<PrismaAddress> {
    return this.users.addAddress(user.userId, input);
  }

  @ResolveField(() => [Address])
  addresses(@Parent() user: PrismaUser): Promise<PrismaAddress[]> {
    return this.users.addresses(user.id);
  }
}
