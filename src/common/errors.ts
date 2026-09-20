import { GraphQLError } from 'graphql';

/* GraphQL errors carrying the extension codes the frontends branch on.
   Kept as plain factories (not Nest HttpExceptions) so the wire format the
   buyer app already handles is unchanged. */

export const unauthenticated = (
  message = 'You must be signed in to do this.',
): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED' } });

export const forbidden = (message = 'Not allowed.'): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });

export const badInput = (message: string): GraphQLError =>
  new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
