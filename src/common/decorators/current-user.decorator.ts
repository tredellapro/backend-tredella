import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { JwtPayload } from '../../auth/token.service';
import type { GqlContext } from '../graphql-context';

/** The signed-in caller, or null on public operations. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | null =>
    GqlExecutionContext.create(context).getContext<GqlContext>().user,
);
