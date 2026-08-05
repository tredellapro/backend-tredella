import type { Context, } from "../../context.js";
import { EVENTS } from "../../context.js";
import type { Mode } from "../../lib/constants.js";
import {
  badInput,
  comparePassword,
  forbidden,
  hashPassword,
  signToken,
  unauthenticated,
} from "../../lib/auth.js";
import { lineTotal, round2 } from "../../lib/pricing.js";
import { notify } from "./helpers.js";
import { Query } from "./queries.js";

const requireUser = (ctx: Context) => {
  if (!ctx.user) throw unauthenticated();
  return ctx.user;
};

const cartOf = (ctx: Context, mode: Mode) =>
  Query.getCart(null, { mode }, ctx);

export const Mutation = {
  /* ---------------- auth ---------------- */

  register: async (
    _: unknown,
    { name, email, password }: { name: string; email: string; password: string },
    ctx: Context
  ) => {
    if (password.length < 6)
      throw badInput("Password must be at least 6 characters.");
    const existing = await ctx.prisma.user.findUnique({ where: { email } });
    if (existing) throw badInput("An account with this email already exists.");
    const user = await ctx.prisma.user.create({
      data: { name, email, password: await hashPassword(password) },
    });
    return {
      token: signToken({ userId: user.id, role: user.role as "BUYER" }),
      user,
    };
  },

  login: async (
    _: unknown,
    { email, password }: { email: string; password: string },
    ctx: Context
  ) => {
    const user = await ctx.prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.password)))
      throw badInput("Invalid email or password.");
    return {
      token: signToken({ userId: user.id, role: user.role as "BUYER" }),
      user,
    };
  },

  addAddress: async (
    _: unknown,
    { input }: { input: { label: string; fullName: string; phone: string; line1: string; city: string; country?: string; isDefault?: boolean } },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    if (input.isDefault) {
      await ctx.prisma.address.updateMany({
        where: { userId: user.userId },
        data: { isDefault: false },
      });
    }
    return ctx.prisma.address.create({
      data: {
        ...input,
        country: input.country ?? "UAE",
        isDefault: input.isDefault ?? false,
        userId: user.userId,
      },
    });
  },

  /* ---------------- wishlist ---------------- */

  addToWishlist: async (
    _: unknown,
    { productId, mode }: { productId: string; mode: Mode },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    const product = await ctx.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw badInput("Product not found.");
    return ctx.prisma.wishlistItem.upsert({
      where: {
        userId_productId_mode: { userId: user.userId, productId, mode },
      },
      create: { userId: user.userId, productId, mode },
      update: {},
    });
  },

  removeFromWishlist: async (
    _: unknown,
    { productId, mode }: { productId: string; mode: Mode },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    await ctx.prisma.wishlistItem.deleteMany({
      where: { userId: user.userId, productId, mode },
    });
    return true;
  },

  /* ---------------- cart ---------------- */

  addToCart: async (
    _: unknown,
    { productId, quantity, mode }: { productId: string; quantity: number; mode: Mode },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    const product = await ctx.prisma.product.findUnique({
      where: { id: productId },
      include: { priceTiers: true },
    });
    if (!product) throw badInput("Product not found.");
    // validates availability, MOQ, stock, and that pricing exists
    lineTotal(product, quantity, mode);

    await ctx.prisma.cartItem.upsert({
      where: {
        userId_productId_mode: { userId: user.userId, productId, mode },
      },
      create: { userId: user.userId, productId, quantity, mode },
      update: { quantity: { increment: quantity } },
    });
    return cartOf(ctx, mode);
  },

  updateCartItem: async (
    _: unknown,
    { cartItemId, quantity }: { cartItemId: string; quantity: number },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    const item = await ctx.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId: user.userId },
      include: { product: { include: { priceTiers: true } } },
    });
    if (!item) throw badInput("Cart item not found.");
    if (quantity <= 0) {
      await ctx.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      lineTotal(item.product, quantity, item.mode as Mode);
      await ctx.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }
    return cartOf(ctx, item.mode as Mode);
  },

  removeFromCart: async (
    _: unknown,
    { cartItemId }: { cartItemId: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    const item = await ctx.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId: user.userId },
    });
    if (!item) throw badInput("Cart item not found.");
    await ctx.prisma.cartItem.delete({ where: { id: item.id } });
    return cartOf(ctx, item.mode as Mode);
  },

  /* ---------------- checkout: main order + seller sub-orders ---------------- */

  createOrder: async (
    _: unknown,
    { mode, addressId }: { mode: Mode; addressId?: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    const cartItems = await ctx.prisma.cartItem.findMany({
      where: { userId: user.userId, mode },
      include: { product: { include: { priceTiers: true } } },
    });
    if (cartItems.length === 0) throw badInput("Your cart is empty.");

    if (addressId) {
      const address = await ctx.prisma.address.findFirst({
        where: { id: addressId, userId: user.userId },
      });
      if (!address) throw badInput("Address not found.");
    }

    // Recalculate every line from the database — the ONLY price source.
    const lines = cartItems.map((item) => {
      const { unitPrice, total } = lineTotal(item.product, item.quantity, mode);
      return { item, unitPrice, total };
    });

    // group by seller → sub-orders
    const bySeller = new Map<string, typeof lines>();
    for (const line of lines) {
      const sellerId = line.item.product.sellerId;
      bySeller.set(sellerId, [...(bySeller.get(sellerId) ?? []), line]);
    }
    const orderTotal = round2(lines.reduce((sum, l) => sum + l.total, 0));

    const order = await ctx.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: user.userId,
          addressId: addressId ?? null,
          mode,
          status: "PENDING",
          total: orderTotal,
        },
      });

      for (const [sellerId, sellerLines] of bySeller) {
        await tx.sellerOrder.create({
          data: {
            orderId: created.id,
            sellerId,
            status: "PENDING",
            subtotal: round2(sellerLines.reduce((s, l) => s + l.total, 0)),
            items: {
              create: sellerLines.map(({ item, unitPrice, total }) => ({
                productId: item.productId,
                name: item.product.name,
                image: item.product.image,
                mode,
                quantity: item.quantity,
                unitPrice,
                total,
              })),
            },
          },
        });

        for (const { item } of sellerLines) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              sold: { increment: item.quantity },
            },
          });
        }
      }

      await tx.cartItem.deleteMany({ where: { userId: user.userId, mode } });
      return created;
    });

    await notify(ctx, user.userId, {
      type: "ORDER_UPDATE",
      title: "Order placed successfully",
      body: `Order #${order.id.slice(-8).toUpperCase()} — total AED ${orderTotal}`,
      link: `/account/orders/${order.id}`,
    });

    return order;
  },

  /* ---------------- reviews (verified purchase only) ---------------- */

  createReview: async (
    _: unknown,
    { orderItemId, rating, text, images }: { orderItemId: string; rating: number; text: string; images?: string[] },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    if (rating < 1 || rating > 5) throw badInput("Rating must be 1–5.");

    const orderItem = await ctx.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { sellerOrder: { include: { order: true } }, review: true },
    });
    if (!orderItem || orderItem.sellerOrder.order.userId !== user.userId)
      throw forbidden("You can only review products you purchased.");
    if (orderItem.sellerOrder.order.status !== "COMPLETED")
      throw forbidden("You can review after your order is completed.");
    if (orderItem.review)
      throw badInput("You already reviewed this order item.");

    const review = await ctx.prisma.review.create({
      data: {
        productId: orderItem.productId,
        userId: user.userId,
        orderItemId,
        rating,
        text,
        images: (images ?? []).join(","),
        verified: true,
      },
    });

    // keep the product's aggregate rating in sync
    const stats = await ctx.prisma.review.aggregate({
      where: { productId: orderItem.productId },
      _avg: { rating: true },
      _count: true,
    });
    await ctx.prisma.product.update({
      where: { id: orderItem.productId },
      data: {
        rating: round2(stats._avg.rating ?? 0),
        reviewsCount: stats._count,
      },
    });

    return review;
  },

  /* ---------------- questions ---------------- */

  askProductQuestion: async (
    _: unknown,
    { productId, text }: { productId: string; text: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    if (text.trim().length < 5) throw badInput("Question is too short.");
    const product = await ctx.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });
    if (!product) throw badInput("Product not found.");

    const question = await ctx.prisma.question.create({
      data: { productId, userId: user.userId, text: text.trim() },
    });

    // notify the seller's user account when the Seller Dashboard exists
    if (product.seller.userId) {
      await notify(ctx, product.seller.userId, {
        type: "SYSTEM",
        title: "New question about your product",
        body: `${product.name}: "${text.trim().slice(0, 80)}"`,
        link: `/product/${product.slug}`,
      });
    }
    return question;
  },

  /* ---------------- chat ---------------- */

  startConversation: async (
    _: unknown,
    { type, sellerSlug, productId, orderId }: { type: string; sellerSlug?: string; productId?: string; orderId?: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    if (type !== "BUYER_SELLER" && type !== "BUYER_ADMIN")
      throw badInput("Buyers can start seller or admin conversations.");

    let sellerId: string | null = null;
    if (type === "BUYER_SELLER") {
      if (!sellerSlug) throw badInput("sellerSlug is required.");
      const seller = await ctx.prisma.seller.findUnique({
        where: { slug: sellerSlug },
      });
      if (!seller) throw badInput("Seller not found.");
      sellerId = seller.id;
    }

    let adminId: string | null = null;
    if (type === "BUYER_ADMIN") {
      const admin = await ctx.prisma.user.findFirst({
        where: { role: "ADMIN" },
      });
      if (!admin) throw badInput("Support is not available right now.");
      adminId = admin.id;
    }

    const existing = await ctx.prisma.conversation.findFirst({
      where: {
        type,
        buyerId: user.userId,
        sellerId,
        productId: productId ?? null,
      },
    });
    if (existing) return existing;

    return ctx.prisma.conversation.create({
      data: {
        type,
        buyerId: user.userId,
        sellerId,
        adminId,
        productId: productId ?? null,
        orderId: orderId ?? null,
      },
    });
  },

  sendMessage: async (
    _: unknown,
    { conversationId, text, attachment }: { conversationId: string; text: string; attachment?: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    if (!text.trim() && !attachment) throw badInput("Message is empty.");

    const conversation = await ctx.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { seller: true },
    });
    if (!conversation) throw badInput("Conversation not found.");
    const participant =
      conversation.buyerId === user.userId ||
      conversation.adminId === user.userId ||
      conversation.seller?.userId === user.userId;
    if (!participant) throw forbidden("You are not part of this conversation.");

    const message = await ctx.prisma.message.create({
      data: {
        conversationId,
        senderId: user.userId,
        text: text.trim(),
        attachment: attachment ?? null,
      },
    });
    await ctx.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await ctx.pubsub.publish(EVENTS.MESSAGE_ADDED, {
      messageAdded: message,
      conversationId,
    });

    // notify the other party
    const recipientId =
      conversation.buyerId === user.userId
        ? (conversation.seller?.userId ?? conversation.adminId)
        : conversation.buyerId;
    if (recipientId) {
      await notify(ctx, recipientId, {
        type: "MESSAGE",
        title: "New message",
        body: text.trim().slice(0, 80),
        link: `/account/messages?c=${conversationId}`,
      });
    }

    return message;
  },

  markMessageAsRead: async (
    _: unknown,
    { conversationId }: { conversationId: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    await ctx.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: user.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return true;
  },

  markNotificationAsRead: async (
    _: unknown,
    { id }: { id?: string },
    ctx: Context
  ) => {
    const user = requireUser(ctx);
    await ctx.prisma.notification.updateMany({
      where: { userId: user.userId, ...(id ? { id } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  },
};
