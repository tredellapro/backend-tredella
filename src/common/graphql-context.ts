import type { Request } from 'express';
import type { JwtPayload } from '../auth/token.service';

/** Shape of the GraphQL execution context for both HTTP and WebSocket calls. */
export type GqlContext = {
  user: JwtPayload | null;
  req?: Request;
};
