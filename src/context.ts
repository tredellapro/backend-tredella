import { PrismaClient } from "@prisma/client";
import { PubSub } from "graphql-subscriptions";
import { verifyToken, type JwtPayload } from "./lib/auth.js";

export const prisma = new PrismaClient();

/* In-memory PubSub is fine for a single dev instance; swap for a Redis-backed
   PubSub when scaling horizontally. */
export const pubsub = new PubSub();

export const EVENTS = {
  MESSAGE_ADDED: "MESSAGE_ADDED",
  NOTIFICATION_ADDED: "NOTIFICATION_ADDED",
} as const;

export type Context = {
  prisma: PrismaClient;
  pubsub: PubSub;
  user: JwtPayload | null;
};

export const userFromAuthHeader = (header?: string): JwtPayload | null => {
  if (!header?.startsWith("Bearer ")) return null;
  return verifyToken(header.slice(7));
};

export const buildContext = (authHeader?: string): Context => ({
  prisma,
  pubsub,
  user: userFromAuthHeader(authHeader),
});
