import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";

/* Vercel serverless entry. The Express app is built once per warm instance and
   reused; a failed build is not cached, so the next request retries instead of
   the instance serving errors forever.

   Not available here (serverless has no long-lived connections or disk):
   • GraphQL subscriptions — chat and notifications fall back to fetch-on-load
   • Local file uploads — /uploads needs object storage (S3, Cloudinary, …)
   Run `npm start` on a persistent host if you need either. */

type App = Awaited<ReturnType<typeof createApp>>;

let appPromise: Promise<App> | null = null;

const getApp = () => {
  appPromise ??= createApp().catch((error) => {
    appPromise = null; // let the next invocation try again
    throw error;
  });
  return appPromise;
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    /* Express' router throws on a path without a leading slash, and a rewritten
       request can arrive with an empty url, so normalise it. */
    if (!req.url) req.url = "/";
    else if (!req.url.startsWith("/")) req.url = `/${req.url}`;

    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("[api] request failed:", error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Internal server error." }));
  }
}
