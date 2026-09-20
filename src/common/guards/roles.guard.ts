import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { forbidden, unauthenticated } from '../errors';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../constants';
import type { GqlContext } from '../graphql-context';

/* Reads @Roles(...) and enforces it. Always used after GqlAuthGuard, but it
   re-checks authentication so a missing guard cannot silently open a route. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const ctx = GqlExecutionContext.create(context).getContext<GqlContext>();
    if (!ctx.user) throw unauthenticated();
    if (!required.includes(ctx.user.role))
      throw forbidden('Your account does not have access to this.');
    return true;
  }
}
