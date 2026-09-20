import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '../common/constants';

export type JwtPayload = { userId: string; role: Role };

/* JWT issuing/verification and password-reset token hashing. Global, because
   the GraphQL context factory, the REST controllers and AuthService all need
   it. */
@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('JWT_SECRET') ?? 'dev-secret';
  }

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: '30d' });
  }

  verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  /** Resolves the caller from an `Authorization: Bearer <token>` header. */
  fromAuthHeader(header?: string | null): JwtPayload | null {
    if (!header?.startsWith('Bearer ')) return null;
    return this.verify(header.slice(7));
  }

  /** Only the hash of a reset token is stored, so a DB leak cannot reset accounts. */
  hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** HMAC secret for the short-lived OAuth `state` parameter. */
  get stateSecret(): string {
    return this.secret;
  }
}
