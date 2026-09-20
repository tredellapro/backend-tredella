import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/token.service';

/** REST counterpart of @CurrentUser — reads what BearerAuthGuard attached. */
export const CurrentRestUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload | null =>
    context.switchToHttp().getRequest<Request & { user?: JwtPayload }>().user ??
    null,
);
