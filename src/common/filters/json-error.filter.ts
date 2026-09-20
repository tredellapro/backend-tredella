import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

/* The web clients read `{ error }` from these REST endpoints, so failures are
   reshaped from Nest's default `{ statusCode, message, error }` envelope. */
@Catch()
export class JsonErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.BAD_REQUEST;

    response.status(status).json({ error: messageOf(exception) });
  }
}

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
