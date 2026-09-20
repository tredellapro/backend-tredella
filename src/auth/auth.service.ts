import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MailerService,
  passwordResetCodeEmail,
  passwordResetEmail,
} from '../mail/mailer.service';
import { TokenService } from './token.service';
import { badInput, forbidden } from '../common/errors';
import type { Role } from '../common/constants';
import { UserRole } from '../common/enums';
import type { AuthPayload } from '../users/models/auth-payload.model';
import type { PasswordResetRequestResult } from '../users/models/password-reset-request-result.model';
import type { PasswordResetTokenPayload } from '../users/models/password-reset-token-payload.model';
import type { SellerRegisterInput } from './dto/seller-register.input';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_CODE_TTL_MS = 15 * 60 * 1000; // shorter: a 6-digit code is weaker
const RESET_CODE_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 6;

/** "Hamza's Store" → "hamzas-store" */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
    private readonly notifications: NotificationsService,
  ) {}

  private payloadFor(user: User): AuthPayload {
    return {
      token: this.tokens.sign({ userId: user.id, role: user.role as Role }),
      user: user as unknown as AuthPayload['user'],
    };
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthPayload> {
    if (password.length < MIN_PASSWORD_LENGTH)
      throw badInput('Password must be at least 6 characters.');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw badInput('An account with this email already exists.');

    const user = await this.prisma.user.create({
      data: { name, email, password: await this.hashPassword(password) },
    });
    return this.payloadFor(user);
  }

  /**
   * `requireRole` is how each dashboard scopes sign-in — the seller app passes
   * SELLER so a buyer account cannot get in, and vice versa.
   */
  async login(
    email: string,
    password: string,
    requireRole?: UserRole | null,
  ): Promise<AuthPayload> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !(await this.comparePassword(password, user.password)))
      throw badInput('Invalid email or password.');

    if (requireRole && user.role !== requireRole)
      throw forbidden(
        requireRole === UserRole.SELLER
          ? 'This account is not registered as a seller.'
          : 'This account cannot sign in here.',
      );

    return this.payloadFor(user);
  }

  /** Creates the SELLER user and their (initially empty) storefront together. */
  async registerSeller(input: SellerRegisterInput): Promise<AuthPayload> {
    if (input.password.length < MIN_PASSWORD_LENGTH)
      throw badInput('Password must be at least 6 characters.');

    const email = input.email.trim().toLowerCase();
    const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
    if (!name) throw badInput('Please enter your first and last name.');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw badInput('An account with this email already exists.');

    const storeName = input.storeName?.trim() || name;
    const slug = await this.uniqueSellerSlug(storeName);
    // hash outside the transaction — bcrypt is slow and would hold it open
    const password = await this.hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, password, role: 'SELLER' },
      });
      await tx.seller.create({
        data: {
          userId: created.id,
          name: storeName,
          slug,
          ...(input.country?.trim() ? { shipsFrom: input.country.trim() } : {}),
        },
      });
      return created;
    });

    return this.payloadFor(user);
  }

  /** Appends -2, -3 … until the storefront slug is free. */
  private async uniqueSellerSlug(storeName: string): Promise<string> {
    const base = slugify(storeName) || 'store';
    for (let suffix = 1; suffix < 100; suffix++) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      const taken = await this.prisma.seller.findUnique({
        where: { slug: candidate },
      });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  /* ---------------- password reset ---------------- */

  async verifyResetToken(token: string): Promise<boolean> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashResetToken(token) },
    });
    return Boolean(record && !record.usedAt && record.expiresAt > new Date());
  }

  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetRequestResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // Respond identically whether or not the account exists, so this endpoint
    // cannot be used to discover which emails are registered.
    if (!user) return { ok: true, emailSent: false };

    // Invalidate any earlier unused tokens for this user.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const link = `${this.mailer.appUrl()}/reset-password?token=${token}`;
    const mail = passwordResetEmail(user.name, link);
    const { delivered } = await this.mailer.send({ ...mail, to: user.email });

    return { ok: true, emailSent: delivered };
  }

  /* ---------------- password reset by 6-digit code ---------------- */

  /**
   * Dashboard flow: email a short code instead of a link, so the mail does not
   * have to know which app asked. Same silence about unknown accounts.
   */
  async requestPasswordResetCode(
    email: string,
  ): Promise<PasswordResetRequestResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return { ok: true, emailSent: false };

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    // a token is minted now only to satisfy the unique column; the real one is
    // issued when the code is accepted
    const placeholder = crypto.randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashResetToken(placeholder),
        codeHash: this.tokens.hashResetCode(user.id, code),
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      },
    });

    const minutes = Math.round(RESET_CODE_TTL_MS / 60000);
    const mail = passwordResetCodeEmail(user.name, code, minutes);
    const { delivered } = await this.mailer.send({ ...mail, to: user.email });

    return { ok: true, emailSent: delivered };
  }

  /** Trades a correct code for a single-use token, which `resetPassword` spends. */
  async verifyPasswordResetCode(
    email: string,
    code: string,
  ): Promise<PasswordResetTokenPayload> {
    const invalid = (): never => {
      throw badInput('This code is invalid or has expired.');
    };

    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return invalid();

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        codeHash: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return invalid();

    if (record.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      // burn it rather than let the window be ground down
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      throw badInput('Too many incorrect attempts. Please request a new code.');
    }

    const expected = this.tokens.hashResetCode(user.id, code.trim());
    if (!record.codeHash || !this.tokens.digestsMatch(expected, record.codeHash)) {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return invalid();
    }

    // clearing codeHash makes the code single-use even though the grant lives on
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: {
        tokenHash: this.tokens.hashResetToken(token),
        codeHash: null,
        attempts: 0,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    return { token };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<AuthPayload> {
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      throw badInput('Password must be at least 6 characters.');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.tokens.hashResetToken(token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date())
      throw badInput('This reset link is invalid or has expired.');

    const password = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.notifications.notify(record.userId, {
      type: 'SYSTEM',
      title: 'Your password was changed',
      body: "If this wasn't you, contact support immediately.",
    });

    return this.payloadFor({ ...record.user, password: '' });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      throw badInput('New password must be at least 6 characters.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await this.comparePassword(currentPassword, user.password)))
      throw badInput('Your current password is incorrect.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: await this.hashPassword(newPassword) },
    });
    return true;
  }
}
