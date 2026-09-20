import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Response } from 'express';

/* The web clients read `{ error }` from these REST endpoints, so failures are
   reshaped from Nest's default `{ statusCode, message, error }` envelope. */
@Catch()
export class JsonErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    response.status(statusOf(exception)).json({ error: messageOf(exception) });
  }
}

/* Services are shared with the GraphQL layer, so one may throw a GraphQLError
   into a REST handler. Map its code rather than flattening everything to 400. */
const GRAPHQL_CODE_STATUS: Record<string, number> = {
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  BAD_USER_INPUT: HttpStatus.BAD_REQUEST,
};

const statusOf = (exception: unknown): number => {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof GraphQLError) {
    const code = exception.extensions?.code;
    if (typeof code === 'string' && GRAPHQL_CODE_STATUS[code])
      return GRAPHQL_CODE_STATUS[code];
  }
  return HttpStatus.BAD_REQUEST;
};

const messageOf = (exception: unknown): string => {
  if (exception instanceof HttpException) {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
    return exception.message;
  }
  return exception instanceof Error ? exception.message : 'Upload failed.';
};
