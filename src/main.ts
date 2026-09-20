import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { corsOptions } from './common/cors';
import { UPLOAD_DIR, diskAvailable } from './uploads/uploads.constants';

/* Long-running server. Unlike the serverless entry (api/index.js) this one has
   a real HTTP server, so GraphQL subscriptions over WebSocket work here. */

export async function configure(app: NestExpressApplication): Promise<void> {
  app.enableCors(corsOptions);
  // product payloads and review bodies exceed Nest's 100kb default
  app.useBodyParser('json', { limit: '2mb' });

  if (diskAvailable)
    app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads', maxAge: '30d' });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  await configure(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Tredella GraphQL API   http://localhost:${port}/graphql`);
  logger.log(`🔌 Subscriptions (ws)     ws://localhost:${port}/graphql`);
}

void bootstrap();
