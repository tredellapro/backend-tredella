import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import { typeDefs } from "./graphql/typeDefs/index.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { buildContext, type Context } from "./context.js";
import { registerSocialAuthRoutes } from "./auth/social.js";
import { registerUploadRoutes } from "./uploads.js";

/* The HTTP half of the API, with no server binding — shared by the local dev
   server (src/index.ts, which adds WebSocket subscriptions) and the Vercel
   serverless entry (api/index.ts, which cannot hold sockets open). */

export const schema: GraphQLSchema = makeExecutableSchema({ typeDefs, resolvers });

/* Allow-list of browser origins. Entries may use a `*` wildcard so Vercel
   preview deployments (buyer-tredella-*.vercel.app) work without redeploying
   the API for every branch. */
const parseOrigins = () =>
  (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const originMatches = (origin: string, pattern: string) => {
  if (!pattern.includes("*")) return origin === pattern;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^.]*");
  return new RegExp(`^${escaped}$`).test(origin);
};

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // server-to-server calls and same-origin requests send no Origin header
    if (!origin) return callback(null, true);
    const allowed = parseOrigins();
    if (allowed.some((pattern) => originMatches(origin, pattern)))
      return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
};

export async function createApp(): Promise<Express> {
  const app = express();

  const apollo = new ApolloServer<Context>({ schema });
  await apollo.start();

  app.use(cors(corsOptions));

  app.get("/health", (_req, res) =>
    res.json({ ok: true, realtime: process.env.VERCEL ? false : true })
  );

  app.use(
    "/graphql",
    express.json({ limit: "2mb" }),
    expressMiddleware(apollo, {
      context: async ({ req }) => buildContext(req.headers.authorization),
    })
  );

  registerSocialAuthRoutes(app);
  registerUploadRoutes(app, process.env.API_URL ?? "http://localhost:4000");

  return app;
}
