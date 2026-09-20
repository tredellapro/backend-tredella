import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { unauthenticated } from '../errors';
import type { GqlContext } from '../graphql-context';

/** Rejects anonymous callers with the UNAUTHENTICATED code the apps expect. */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context).getContext<GqlContext>();
    if (!ctx.user) throw unauthenticated();
    return true;
  }
}
