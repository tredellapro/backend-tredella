import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../../auth/token.service';

/* REST counterpart of GqlAuthGuard — used by the upload endpoint, which is
   plain HTTP because multipart bodies do not travel over GraphQL here. */
@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = this.tokens.fromAuthHeader(request.headers.authorization);
    if (!user)
      throw new UnauthorizedException('Please sign in to upload photos.');
    (request as Request & { user?: unknown }).user = user;
    return true;
  }
}
