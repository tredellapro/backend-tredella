import type { Context } from "../../context.js";
import type { Mode } from "../../lib/constants.js";
import { unauthenticated, badInput } from "../../lib/auth.js";
import { lineTotal, unitPriceFor, round2 } from "../../lib/pricing.js";
import {
  queryProducts,
  modeWhere,
  type ProductFilterInput,
  type SortBy,
} from "./helpers.js";
import { hashToken } from "./mutations.js";

type ModeArg = { mode: Mode };

export const Query = {
  me: async (_: unknown, __: unknown, ctx: Context) => {
    if (!ctx.user) return null;
    return ctx.prisma.user.findUnique({ where: { id: ctx.user.userId } });
  },

  verifyResetToken: async (
    _: unknown,
    { token }: { token: string },
    ctx: Context
  ) => {
    const record = await ctx.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    return Boolean(record && !record.usedAt && record.expiresAt > new Date());
  },

  /* ---------------- catalog ---------------- */

  getHomePageData: async (_: unknown, { mode }: ModeArg, ctx: Context) => {
    const base = modeWhere(mode);
    const [flashDeals, topRated, newArrivals, bigDiscounts, categories] =
      await Promise.all([
        ctx.prisma.product.findMany({
          where: { ...base, oldPrice: { not: null } },
          orderBy: { sold: "desc" },
          take: 8,
        }),
        ctx.prisma.product.findMany({
          where: base,
          orderBy: [{ rating: "desc" }, { reviewsCount: "desc" }],
          take: 4,
        }),
        ctx.prisma.product.findMany({
          where: base,
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        ctx.prisma.product.findMany({
          where: { ...base, oldPrice: { not: null } },
          orderBy: { retailPrice: "asc" },
          take: 8,
        }),
        ctx.prisma.category.findMany({ orderBy: { name: "asc" } }),
      ]);
    return {
      heroProducts: flashDeals.slice(0, 2),
      flashDeals,
      topRated,
      newArrivals,
      bigDiscounts,
      categories,
    };
  },

  getCategories: (_: unknown, __: unknown, ctx: Context) =>
    ctx.prisma.category.findMany({ orderBy: { name: "asc" } }),

  getCategory: (_: unknown, { slug }: { slug: string }, ctx: Context) =>
    ctx.prisma.category.findUnique({ where: { slug } }),

  getSubcategory: async (
    _: unknown,
    { categorySlug, slug }: { categorySlug: string; slug: string },
    ctx: Context
  ) => {
    const category = await ctx.prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    if (!category) return null;
    return ctx.prisma.subcategory.findUnique({
      where: { categoryId_slug: { categoryId: category.id, slug } },
    });
  },

  getProducts: (
    _: unknown,
    args: {
      mode: Mode;
      filter?: ProductFilterInput;
      sortBy?: SortBy;
      page?: number;
      pageSize?: number;
    },
    ctx: Context
  ) => queryProducts(ctx, args),

  getProduct: (
    _: unknown,
    { slug, mode }: { slug: string } & ModeArg,
    ctx: Context
  ) =>
    ctx.prisma.product.findFirst({
      where: { slug, ...modeWhere(mode) },
    }),

  /* Server-side price quote — same code path as order creation. */
  getPriceQuote: async (
    _: unknown,
    { productId, quantity, mode }: { productId: string; quantity: number } & ModeArg,
    ctx: Context
  ) => {
    const product = await ctx.prisma.product.findUnique({
      where: { id: productId },
      include: { priceTiers: true },
    });
    if (!product) throw badInput("Product not found.");
    const unitPrice = unitPriceFor(product, quantity, mode);
    return { quantity, unitPrice, total: round2(unitPrice * quantity), mode };
  },

  getRelatedProducts: async (
    _: unknown,
    { productId, mode, limit }: { productId: string; limit: number } & ModeArg,
    ctx: Context
  ) => {
    const product = await ctx.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return [];
    const base = { ...modeWhere(mode), id: { not: product.id } };

    const related = await ctx.prisma.product.findMany({
      where: { ...base, subcategoryId: product.subcategoryId },
      orderBy: { sold: "desc" },
      take: limit,
    });
    if (related.length < limit) {
      const fill = await ctx.prisma.product.findMany({
        where: {
          ...base,
          categoryId: product.categoryId,
          id: { notIn: [product.id, ...related.map((p) => p.id)] },
        },
        orderBy: { sold: "desc" },
        take: limit - related.length,
      });
      related.push(...fill);
    }
    return related;
  },

  /* ---------------- sellers ---------------- */

  getSeller: (_: unknown, { slug }: { slug: string }, ctx: Context) =>
    ctx.prisma.seller.findUnique({ where: { slug } }),

  getSellerProducts: (
    _: unknown,
    args: {
      sellerSlug: string;
      mode: Mode;
      filter?: ProductFilterInput;
      sortBy?: SortBy;
      page?: number;
      pageSize?: number;
    },
    ctx: Context
  ) =>
    queryProducts(ctx, {
      ...args,
      filter: { ...(args.filter ?? {}), sellerSlug: args.sellerSlug },
    }),

  /* ---------------- reviews & questions ---------------- */

  getProductReviews: async (
    _: unknown,
    { productId, page, pageSize }: { productId: string; page: number; pageSize: number },
    ctx: Context
  ) => {
    const where = { productId };
    const [total, items, all] = await Promise.all([
      ctx.prisma.review.count({ where }),
      ctx.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      ctx.prisma.review.findMany({ where, select: { rating: true } }),
    ]);
    const distribution = [1, 2, 3, 4, 5].map(
      (star) => all.filter((r) => r.rating === star).length
    );
    const average =
      all.length > 0
        ? round2(all.reduce((sum, r) => sum + r.rating, 0) / all.length)
        : 0;
    return {
      items,
      pageInfo: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNextPage: page * pageSize < total,
      },
      average,
      distribution,
    };
  },

  getProductQuestions: (
    _: unknown,
    { productId }: { productId: string },
    ctx: Context
  ) =>
    ctx.prisma.question.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    }),

  /* ---------------- buyer account ---------------- */

  getWishlist: async (
    _: unknown,
    { mode }: { mode?: Mode },
    ctx: Context
  ) => {
    if (!ctx.user) throw unauthenticated();
    return ctx.prisma.wishlistItem.findMany({
      where: { userId: ctx.user.userId, ...(mode ? { mode } : {}) },
      orderBy: { createdAt: "desc" },
    });
  },

  getCart: async (_: unknown, { mode }: ModeArg, ctx: Context) => {
    if (!ctx.user) throw unauthenticated();
    const items = await ctx.prisma.cartItem.findMany({
      where: { userId: ctx.user.userId, mode },
      include: {
        product: { include: { priceTiers: true, seller: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const groups = new Map<
      string,
      { seller: unknown; items: unknown[]; subtotal: number }
    >();
    let total = 0;
    let itemCount = 0;

    for (const item of items) {
      const { unitPrice, total: itemTotal } = lineTotal(
        item.product,
        item.quantity,
        mode
      );
      const entry = groups.get(item.product.sellerId) ?? {
        seller: item.product.seller,
        items: [],
        subtotal: 0,
      };
      entry.items.push({ ...item, unitPrice, total: itemTotal });
      entry.subtotal = round2(entry.subtotal + itemTotal);
      groups.set(item.product.sellerId, entry);
      total = round2(total + itemTotal);
      itemCount += item.quantity;
    }

    return { groups: [...groups.values()], itemCount, total };
  },

  getOrders: async (
    _: unknown,
    { page, pageSize }: { page: number; pageSize: number },
    ctx: Context
  ) => {
    if (!ctx.user) throw unauthenticated();
    return ctx.prisma.order.findMany({
      where: { userId: ctx.user.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  },

  getOrder: async (_: unknown, { id }: { id: string }, ctx: Context) => {
    if (!ctx.user) throw unauthenticated();
    return ctx.prisma.order.findFirst({
      where: { id, userId: ctx.user.userId },
    });
  },

  /* ---------------- notifications & chat ---------------- */

  getNotifications: async (
    _: unknown,
    { unreadOnly }: { unreadOnly: boolean },
    ctx: Context
  ) => {
    if (!ctx.user) throw unauthenticated();
    return ctx.prisma.notification.findMany({
      where: {
        userId: ctx.user.userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  getConversations: async (_: unknown, __: unknown, ctx: Context) => {
    if (!ctx.user) throw unauthenticated();
    const { userId, role } = ctx.user;
    return ctx.prisma.conversation.findMany({
      where:
        role === "ADMIN"
          ? { adminId: userId }
          : { OR: [{ buyerId: userId }, { seller: { userId } }] },
      orderBy: { updatedAt: "desc" },
    });
  },

  getMessages: async (
    _: unknown,
    { conversationId, page, pageSize }: { conversationId: string; page: number; pageSize: number },
    ctx: Context
  ) => {
    if (!ctx.user) throw unauthenticated();
    const conversation = await ctx.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { seller: true },
    });
    if (!conversation) throw badInput("Conversation not found.");
    const { userId } = ctx.user;
    const participant =
      conversation.buyerId === userId ||
      conversation.adminId === userId ||
      conversation.seller?.userId === userId ||
      ctx.user.role === "ADMIN";
    if (!participant) throw unauthenticated();

    const messages = await ctx.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return messages.reverse();
  },

  /* ---------------- search ---------------- */

  searchSuggestions: async (
    _: unknown,
    { query, mode }: { query: string } & ModeArg,
    ctx: Context
  ) => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    const products = await ctx.prisma.product.findMany({
      where: {
        ...modeWhere(mode),
        OR: [{ name: { contains: term } }, { brand: { contains: term } }],
      },
      select: { name: true, brand: true, sold: true },
      orderBy: { sold: "desc" },
      take: 40,
    });

    // rank: name starts with term → a word starts with term → contains
    const rank = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.startsWith(term)) return 0;
      if (lower.split(/[^a-z0-9]+/).some((w) => w.startsWith(term))) return 1;
      return 2;
    };

    return [...new Set(products.map((p) => p.name))]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  },
};
