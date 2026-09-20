import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayload } from '../users/models/auth-payload.model';
import { PasswordResetRequestResult } from '../users/models/password-reset-request-result.model';
import { PasswordResetTokenPayload } from '../users/models/password-reset-token-payload.model';
import { SellerRegisterInput } from './dto/seller-register.input';
import { UserRole } from '../common/enums';
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
    @Args('requireRole', {
      type: () => UserRole,
      nullable: true,
      description:
        'Reject the sign-in unless the account has this role. Each dashboard passes its own.',
    })
    requireRole?: UserRole | null,
  ): Promise<AuthPayload> {
    return this.auth.login(email, password, requireRole);
  }

  @Mutation(() => AuthPayload, {
    description: 'Creates a SELLER account together with its storefront',
  })
  registerSeller(
    @Args('input') input: SellerRegisterInput,
  ): Promise<AuthPayload> {
    return this.auth.registerSeller(input);
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

  @Mutation(() => PasswordResetRequestResult, {
    description:
      'Emails a 6-digit code instead of a link — used by the seller and admin dashboards',
  })
  requestPasswordResetCode(
    @Args('email') email: string,
  ): Promise<PasswordResetRequestResult> {
    return this.auth.requestPasswordResetCode(email);
  }

  @Mutation(() => PasswordResetTokenPayload, {
    description: 'Exchanges a correct 6-digit code for a resetPassword token',
  })
  verifyPasswordResetCode(
    @Args('email') email: string,
    @Args('code') code: string,
  ): Promise<PasswordResetTokenPayload> {
    return this.auth.verifyPasswordResetCode(email, code);
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
