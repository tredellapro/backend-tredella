import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { typeDefs } from "./graphql/typeDefs/index.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { buildContext, prisma, type Context } from "./context.js";
import { registerSocialAuthRoutes } from "./auth/social.js";
import { registerUploadRoutes } from "./uploads.js";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

async function main() {
  const app = express();
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for GraphQL subscriptions (chat, notifications)
  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const wsCleanup = useServer(
    {
      schema,
      context: (ctx): Context =>
        buildContext(
          (ctx.connectionParams?.authorization as string | undefined) ??
            (ctx.connectionParams?.Authorization as string | undefined)
        ),
    },
    wsServer
  );

  const apollo = new ApolloServer<Context>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  await apollo.start();

  app.use(
    "/graphql",
    cors({ origin: CORS_ORIGINS, credentials: true }),
    express.json({ limit: "2mb" }),
    expressMiddleware(apollo, {
      context: async ({ req }) => buildContext(req.headers.authorization),
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Google / Facebook sign-in (OAuth redirect flow)
  app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  registerSocialAuthRoutes(app);

  // Review photo uploads + static serving
  registerUploadRoutes(
    app,
    process.env.API_URL ?? `http://localhost:${PORT}`
  );

  httpServer.listen(PORT, () => {
    console.log(`🚀 Tredella GraphQL API   http://localhost:${PORT}/graphql`);
    console.log(`🔌 Subscriptions (ws)     ws://localhost:${PORT}/graphql`);
  });
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
