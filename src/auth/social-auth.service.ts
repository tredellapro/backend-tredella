import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

/* Google / Facebook sign-in using the OAuth authorization-code flow.
   The provider redirects back to us, we exchange the code server-side (so the
   client secret never reaches the browser), then hand the app our own JWT.

   Configure per provider in .env; a provider without credentials simply
   reports that it is unavailable instead of failing at redirect time. */

export type ProviderKey = 'google' | 'facebook';

type Profile = { email: string; name: string; avatar?: string };

type ProviderConfig = {
  clientIdKey: string;
  clientSecretKey: string;
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
};

const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  google: {
    clientIdKey: 'GOOGLE_CLIENT_ID',
    clientSecretKey: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'openid email profile',
  },
  facebook: {
    clientIdKey: 'FACEBOOK_APP_ID',
    clientSecretKey: 'FACEBOOK_APP_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    profileUrl:
      'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
    scope: 'email public_profile',
  },
};

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  isKnownProvider(provider: string): provider is ProviderKey {
    return provider === 'google' || provider === 'facebook';
  }

  isConfigured(provider: ProviderKey): boolean {
    return Boolean(this.clientId(provider) && this.clientSecret(provider));
  }

  private clientId(provider: ProviderKey): string | undefined {
    return this.config.get<string>(PROVIDERS[provider].clientIdKey);
  }

  private clientSecret(provider: ProviderKey): string | undefined {
    return this.config.get<string>(PROVIDERS[provider].clientSecretKey);
  }

  private apiUrl(): string {
    return (
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get<string>('PORT') ?? 4000}`
    );
  }

  appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  private redirectUri(provider: ProviderKey): string {
    return `${this.apiUrl()}/auth/${provider}/callback`;
  }

  /* ---------------- signed state ---------------- */

  /** Short-lived signed state, so the callback can't be replayed or forged. */
  makeState(next: string): string {
    const payload = Buffer.from(
      JSON.stringify({ next, ts: Date.now() }),
    ).toString('base64url');
    return `${payload}.${this.signState(payload)}`;
  }

  readState(state: string): { next: string } | null {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) return null;
    if (sig !== this.signState(payload)) return null;
    try {
      const data = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as { next?: unknown; ts?: number };
      if (Date.now() - (data.ts ?? 0) > STATE_TTL_MS) return null;
      return { next: typeof data.next === 'string' ? data.next : '/' };
    } catch {
      return null;
    }
  }

  private signState(payload: string): string {
    return crypto
      .createHmac('sha256', this.tokens.stateSecret)
      .update(payload)
      .digest('base64url');
  }

  /* ---------------- OAuth flow ---------------- */

  authorizeUrl(provider: ProviderKey, next: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId(provider)!,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: PROVIDERS[provider].scope,
      state: this.makeState(next),
    });
    return `${PROVIDERS[provider].authUrl}?${params.toString()}`;
  }

  /** Exchanges the authorization code, reads the profile and issues our JWT. */
  async completeSignIn(
    provider: ProviderKey,
    code: string,
  ): Promise<{ user: User; token: string }> {
    const body = new URLSearchParams({
      client_id: this.clientId(provider)!,
      client_secret: this.clientSecret(provider)!,
      redirect_uri: this.redirectUri(provider),
      grant_type: 'authorization_code',
      code,
    });
    const tokenRes = await fetch(PROVIDERS[provider].tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed.');
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token?: string;
    };
    if (!accessToken) throw new Error('No access token returned.');

    const profile = await this.fetchProfile(provider, accessToken);
    const user = await this.upsertUser(profile);
    return {
      user,
      token: this.tokens.sign({
        userId: user.id,
        role: user.role as 'BUYER',
      }),
    };
  }

  private async fetchProfile(
    provider: ProviderKey,
    accessToken: string,
  ): Promise<Profile> {
    const res = await fetch(PROVIDERS[provider].profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
      throw new Error('Could not read your profile from the provider.');
    const data = (await res.json()) as {
      email?: string;
      name?: string;
      picture?: string | { data?: { url?: string } };
    };
    if (!data.email)
      throw new Error(
        'Your account did not share an email address, which we need to create your Tredella account.',
      );
    const avatar =
      typeof data.picture === 'string' ? data.picture : data.picture?.data?.url;
    return { email: data.email, name: data.name ?? data.email, avatar };
  }

  private async upsertUser(profile: Profile): Promise<User> {
    const email = profile.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // keep the avatar fresh, but never touch an existing password
      if (profile.avatar && existing.avatar !== profile.avatar) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { avatar: profile.avatar },
        });
      }
      return existing;
    }
    // Social accounts have no local password; a random one keeps the column
    // non-null while remaining unusable for password login.
    return this.prisma.user.create({
      data: {
        email,
        name: profile.name,
        avatar: profile.avatar ?? null,
        password: crypto.randomBytes(32).toString('hex'),
        role: 'BUYER',
      },
    });
  }
}
