/* String "enums" — kept as validated strings so the Prisma schema stays
   SQLite-compatible in dev and PostgreSQL-ready in production. */

export const ROLES = ["BUYER", "SELLER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const MODES = ["RETAIL", "WHOLESALE"] as const;
export type Mode = (typeof MODES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CONVERSATION_TYPES = [
  "BUYER_SELLER",
  "BUYER_ADMIN",
  "SELLER_ADMIN",
] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "MESSAGE",
  "QUESTION_ANSWERED",
  "ORDER_UPDATE",
  "DELIVERY_UPDATE",
  "REVIEW_ELIGIBLE",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const isMode = (v: string): v is Mode => MODES.includes(v as Mode);
