import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService, passwordResetEmail } from '../mail/mailer.service';
import { TokenService } from './token.service';
import { badInput } from '../common/errors';
import type { Role } from '../common/constants';
import type { AuthPayload } from '../users/models/auth-payload.model';
import type { PasswordResetRequestResult } from '../users/models/password-reset-request-result.model';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_PASSWORD_LENGTH = 6;

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

  async login(email: string, password: string): Promise<AuthPayload> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await this.comparePassword(password, user.password)))
      throw badInput('Invalid email or password.');
    return this.payloadFor(user);
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
