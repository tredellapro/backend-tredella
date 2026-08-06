import "dotenv/config";
import http from "node:http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { createApp, schema } from "./app.js";
import { buildContext, prisma, type Context } from "./context.js";

/* Local / long-running server. Adds GraphQL subscriptions over WebSocket,
   which serverless platforms such as Vercel cannot provide. */

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const app = await createApp();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  useServer(
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
