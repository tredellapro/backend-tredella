import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayload } from '../users/models/auth-payload.model';
import { PasswordResetRequestResult } from '../users/models/password-reset-request-result.model';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from './token.service';

@Resolver()
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Query(() => Boolean, {
    description: 'Checks a reset link before showing the new-password form',
  })
  verifyResetToken(@Args('token') token: string): Promise<boolean> {
    return this.auth.verifyResetToken(token);
  }

  @Mutation(() => AuthPayload)
  register(
    @Args('name') name: string,
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.auth.register(name, email, password);
  }

  @Mutation(() => AuthPayload)
  login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.auth.login(email, password);
  }

  @Mutation(() => PasswordResetRequestResult, {
    description:
      'Always reports success so the response cannot reveal registered emails',
  })
  requestPasswordReset(
    @Args('email') email: string,
  ): Promise<PasswordResetRequestResult> {
    return this.auth.requestPasswordReset(email);
  }

  @Mutation(() => AuthPayload, {
    description: 'Signs the user straight in once the new password is saved',
  })
  resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<AuthPayload> {
    return this.auth.resetPassword(token, newPassword);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return this.auth.changePassword(user.userId, currentPassword, newPassword);
  }
}
