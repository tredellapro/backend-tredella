require('reflect-metadata');

const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');

/* Vercel serverless entry.
 *
 * This file is plain JavaScript and loads the *compiled* app from dist/ on
 * purpose: Vercel transpiles api/ with esbuild, which does not emit the
 * decorator metadata Nest's dependency injection relies on. `npm run build`
 * (tsc, via nest build) does, so the container is wired correctly.
 *
 * Not available here (serverless has no long-lived connections or disk):
 *   • GraphQL subscriptions — chat and notifications fall back to fetch-on-load
 *   • Local file uploads — /uploads needs object storage (S3, Cloudinary, …)
 * Run `npm start` on a persistent host if you need either.
 */

const { AppModule } = require('../dist/app.module');
const { corsOptions } = require('../dist/common/cors');

const server = express();
let ready = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.enableCors(corsOptions);
  app.useBodyParser('json', { limit: '2mb' });
  await app.init();
}

// A failed boot is not cached, so the next invocation retries instead of the
// warm instance serving errors forever.
function getReady() {
  if (!ready) {
    ready = bootstrap().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

module.exports = async function handler(req, res) {
  try {
    /* Express' router throws on a path without a leading slash, and a rewritten
       request can arrive with an empty url, so normalise it. */
    if (!req.url) req.url = '/';
    else if (!req.url.startsWith('/')) req.url = `/${req.url}`;

    await getReady();
    return server(req, res);
  } catch (error) {
    console.error('[api] request failed:', error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error.' }));
  }
};
