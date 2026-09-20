import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../constants';
import type { JwtPayload } from '../../auth/token.service';

/* REST counterpart of RolesGuard. Reads the caller that BearerAuthGuard
   attached, so it must run after it.
   Throws HTTP exceptions, not the GraphQL error factories — those carry no
   status, so the JSON filter would report every refusal as a 400. */
@Injectable()
export class RestRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    if (!request.user)
      throw new UnauthorizedException('You must be signed in to do this.');
    if (!required.includes(request.user.role))
      throw new ForbiddenException('Your account does not have access to this.');
    return true;
  }
}
