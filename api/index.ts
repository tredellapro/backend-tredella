import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";

/* Vercel serverless entry. The Express app is created once per warm instance
   and reused across invocations.

   Not available here (serverless has no long-lived connections or disk):
   • GraphQL subscriptions — chat and notifications fall back to fetch-on-load
   • Local file uploads — /uploads needs object storage (S3, Cloudinary, …)
   Run `npm start` on a persistent host if you need either. */

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  appPromise ??= createApp();
  const app = await appPromise;
  return app(req, res);
}
