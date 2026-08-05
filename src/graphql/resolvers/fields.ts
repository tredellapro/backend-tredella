import type {
  Category,
  Conversation,
  Message,
  Notification,
  Order,
  OrderItem,
  Product,
  Question,
  Review,
  Seller,
  SellerOrder,
  Subcategory,
  User,
  WishlistItem,
} from "@prisma/client";
import type { Context } from "../../context.js";
import { iso, modeWhere } from "./helpers.js";
import type { Mode } from "../../lib/constants.js";

/* Relation lookups use Prisma's fluent API (findUnique().relation()) which
   batches identical parent queries — avoids the classic GraphQL N+1. */

export const fieldResolvers = {
  User: {
    createdAt: (u: User) => iso(u.createdAt),
    addresses: (u: User, _: unknown, ctx: Context) =>
      ctx.prisma.user.findUnique({ where: { id: u.id } }).addresses(),
  },

  Category: {
    subcategories: (c: Category, _: unknown, ctx: Context) =>
      ctx.prisma.category.findUnique({ where: { id: c.id } }).subcategories(),
    productCount: (c: Category, { mode }: { mode: Mode }, ctx: Context) =>
      ctx.prisma.product.count({
        where: { categoryId: c.id, ...modeWhere(mode) },
      }),
  },

  Subcategory: {
    category: (s: Subcategory, _: unknown, ctx: Context) =>
      ctx.prisma.subcategory.findUnique({ where: { id: s.id } }).category(),
    productCount: (s: Subcategory, { mode }: { mode: Mode }, ctx: Context) =>
      ctx.prisma.product.count({
        where: { subcategoryId: s.id, ...modeWhere(mode) },
      }),
  },

  Product: {
    createdAt: (p: Product) => iso(p.createdAt),
    inStock: (p: Product) => p.stock > 0,
    images: async (p: Product, _: unknown, ctx: Context) => {
      const images = await ctx.prisma.product
        .findUnique({ where: { id: p.id } })
        .images({ orderBy: { position: "asc" } });
      // always at least the main image
      return images?.length
        ? images
        : [{ id: `${p.id}-main`, url: p.image, position: 0 }];
    },
    category: (p: Product, _: unknown, ctx: Context) =>
      ctx.prisma.product.findUnique({ where: { id: p.id } }).category(),
    subcategory: (p: Product, _: unknown, ctx: Context) =>
      ctx.prisma.product.findUnique({ where: { id: p.id } }).subcategory(),
    seller: (p: Product, _: unknown, ctx: Context) =>
      ctx.prisma.product.findUnique({ where: { id: p.id } }).seller(),
    priceTiers: (p: Product, _: unknown, ctx: Context) =>
      ctx.prisma.product
        .findUnique({ where: { id: p.id } })
        .priceTiers({ orderBy: { minQty: "asc" } }),
    attributes: (p: Product, _: unknown, ctx: Context) =>
      ctx.prisma.product.findUnique({ where: { id: p.id } }).attributes(),
  },

  Seller: {
    joinedAt: (s: Seller) => iso(s.joinedAt),
    productCount: (s: Seller, _: unknown, ctx: Context) =>
      ctx.prisma.product.count({ where: { sellerId: s.id } }),
  },

  Review: {
    createdAt: (r: Review) => iso(r.createdAt),
    images: (r: Review) => (r.images ? r.images.split(",").filter(Boolean) : []),
    user: (r: Review, _: unknown, ctx: Context) =>
      ctx.prisma.review.findUnique({ where: { id: r.id } }).user(),
  },

  Question: {
    createdAt: (q: Question) => iso(q.createdAt),
    answeredAt: (q: Question) => iso(q.answeredAt),
    user: (q: Question, _: unknown, ctx: Context) =>
      ctx.prisma.question.findUnique({ where: { id: q.id } }).user(),
  },

  WishlistItem: {
    createdAt: (w: WishlistItem) => iso(w.createdAt),
    product: (w: WishlistItem, _: unknown, ctx: Context) =>
      ctx.prisma.wishlistItem.findUnique({ where: { id: w.id } }).product(),
  },

  Order: {
    createdAt: (o: Order) => iso(o.createdAt),
    address: (o: Order, _: unknown, ctx: Context) =>
      o.addressId
        ? ctx.prisma.address.findUnique({ where: { id: o.addressId } })
        : null,
    sellerOrders: (o: Order, _: unknown, ctx: Context) =>
      ctx.prisma.order.findUnique({ where: { id: o.id } }).sellerOrders(),
  },

  SellerOrder: {
    seller: (so: SellerOrder, _: unknown, ctx: Context) =>
      ctx.prisma.sellerOrder.findUnique({ where: { id: so.id } }).seller(),
    items: (so: SellerOrder, _: unknown, ctx: Context) =>
      ctx.prisma.sellerOrder.findUnique({ where: { id: so.id } }).items(),
  },

  OrderItem: {
    product: (oi: OrderItem, _: unknown, ctx: Context) =>
      ctx.prisma.orderItem.findUnique({ where: { id: oi.id } }).product(),
    reviewable: async (oi: OrderItem, _: unknown, ctx: Context) => {
      const item = await ctx.prisma.orderItem.findUnique({
        where: { id: oi.id },
        include: { sellerOrder: { include: { order: true } }, review: true },
      });
      return (
        item?.sellerOrder.order.status === "COMPLETED" && item.review == null
      );
    },
  },

  Conversation: {
    updatedAt: (c: Conversation) => iso(c.updatedAt),
    seller: (c: Conversation, _: unknown, ctx: Context) =>
      c.sellerId
        ? ctx.prisma.seller.findUnique({ where: { id: c.sellerId } })
        : null,
    product: (c: Conversation, _: unknown, ctx: Context) =>
      c.productId
        ? ctx.prisma.product.findUnique({ where: { id: c.productId } })
        : null,
    lastMessage: (c: Conversation, _: unknown, ctx: Context) =>
      ctx.prisma.message.findFirst({
        where: { conversationId: c.id },
        orderBy: { createdAt: "desc" },
      }),
    unreadCount: (c: Conversation, _: unknown, ctx: Context) =>
      ctx.user
        ? ctx.prisma.message.count({
            where: {
              conversationId: c.id,
              senderId: { not: ctx.user.userId },
              readAt: null,
            },
          })
        : 0,
  },

  Message: {
    createdAt: (m: Message) => iso(m.createdAt),
    readAt: (m: Message) => iso(m.readAt),
    sender: (m: Message, _: unknown, ctx: Context) =>
      ctx.prisma.message.findUnique({ where: { id: m.id } }).sender(),
    isMine: (m: Message, _: unknown, ctx: Context) =>
      ctx.user?.userId === m.senderId,
  },

  Notification: {
    createdAt: (n: Notification) => iso(n.createdAt),
    readAt: (n: Notification) => iso(n.readAt),
  },
};
