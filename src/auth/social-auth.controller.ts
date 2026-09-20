import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SocialAuthService, type ProviderKey } from './social-auth.service';

/* REST, not GraphQL: OAuth is a browser redirect dance, so these endpoints
   have to be plain HTTP GETs the provider can send the user back to. */
@Controller('auth')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(private readonly social: SocialAuthService) {}

  /** Lets the login page show only the buttons that will actually work. */
  @Get('providers')
  providers(): Record<ProviderKey, boolean> {
    return {
      google: this.social.isConfigured('google'),
      facebook: this.social.isConfigured('facebook'),
    };
  }

  @Get(':provider')
  start(
    @Param('provider') provider: string,
    @Query('next') next: string | undefined,
    @Res() res: Response,
  ): void {
    if (!this.social.isKnownProvider(provider))
      throw new NotFoundException('Unknown provider.');

    if (!this.social.isConfigured(provider)) {
      const message = `${provider} sign-in is not configured yet.`;
      res.redirect(
        `${this.social.appUrl()}/login?error=${encodeURIComponent(message)}`,
      );
      return;
    }

    res.redirect(this.social.authorizeUrl(provider, next ?? '/'));
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.social.isKnownProvider(provider))
      throw new NotFoundException('Unknown provider.');

    const fail = (message: string): void =>
      res.redirect(
        `${this.social.appUrl()}/login?error=${encodeURIComponent(message)}`,
      );

    if (!code || !state) return fail('Sign-in was cancelled.');

    const parsed = this.social.readState(state);
    if (!parsed) return fail('Your sign-in link expired. Please try again.');

    try {
      const { user, token } = await this.social.completeSignIn(provider, code);
      const params = new URLSearchParams({
        token,
        next: parsed.next,
        user: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }),
      });
      res.redirect(`${this.social.appUrl()}/auth/callback?${params.toString()}`);
    } catch (error) {
      this.logger.error(`[${provider}] sign-in failed`, error as Error);
      fail(
        error instanceof Error
          ? error.message
          : 'Sign-in failed. Please try again.',
      );
    }
  }
}
