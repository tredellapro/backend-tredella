import { Inject, Injectable } from '@nestjs/common';
import type { Conversation, Message } from '@prisma/client';
import type { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PUB_SUB } from '../common/pubsub/pubsub.module';
import { EVENTS } from '../common/constants';
import { badInput, forbidden, unauthenticated } from '../common/errors';
import { paginate } from '../common/pagination';
import type { JwtPayload } from '../auth/token.service';

type ConversationWithSeller = Conversation & {
  seller: { userId: string | null } | null;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** Admins see their own queue; everyone else sees what they take part in. */
  listConversations(user: JwtPayload): Promise<Conversation[]> {
    const { userId, role } = user;
    return this.prisma.conversation.findMany({
      where:
        role === 'ADMIN'
          ? { adminId: userId }
          : { OR: [{ buyerId: userId }, { seller: { userId } }] },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private isParticipant(
    conversation: ConversationWithSeller,
    userId: string,
  ): boolean {
    return (
      conversation.buyerId === userId ||
      conversation.adminId === userId ||
      conversation.seller?.userId === userId
    );
  }

  async listMessages(
    user: JwtPayload,
    conversationId: string,
    page?: number | null,
    pageSize?: number | null,
  ): Promise<Message[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { seller: true },
    });
    if (!conversation) throw badInput('Conversation not found.');
    if (!this.isParticipant(conversation, user.userId) && user.role !== 'ADMIN')
      throw unauthenticated();

    const { skip, take } = paginate(page, pageSize, 100);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    // newest page fetched, but rendered oldest-first
    return messages.reverse();
  }

  /**
   * Reuses an existing thread rather than opening a second one.
   *
   * SELLER_ADMIN is the seller dashboard's support thread: the seller is on it
   * as the seller, not as a buyer, so it carries no buyerId and is deduped on
   * the seller alone.
   */
  async startConversation(
    userId: string,
    type: string,
    sellerSlug?: string | null,
    productId?: string | null,
    orderId?: string | null,
  ): Promise<Conversation> {
    if (
      type !== 'BUYER_SELLER' &&
      type !== 'BUYER_ADMIN' &&
      type !== 'SELLER_ADMIN'
    )
      throw badInput('Unknown conversation type.');

    const sellerThread = type === 'SELLER_ADMIN';

    let sellerId: string | null = null;
    if (type === 'BUYER_SELLER') {
      if (!sellerSlug) throw badInput('sellerSlug is required.');
      const seller = await this.prisma.seller.findUnique({
        where: { slug: sellerSlug },
      });
      if (!seller) throw badInput('Seller not found.');
      sellerId = seller.id;
    }

    if (sellerThread) {
      const seller = await this.prisma.seller.findUnique({ where: { userId } });
      if (!seller) throw badInput('Only a seller can open this conversation.');
      sellerId = seller.id;
    }

    let adminId: string | null = null;
    if (type === 'BUYER_ADMIN' || sellerThread) {
      const admin = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
      if (!admin) throw badInput('Support is not available right now.');
      adminId = admin.id;
    }

    const existing = await this.prisma.conversation.findFirst({
      where: sellerThread
        ? { type, sellerId, productId: null }
        : { type, buyerId: userId, sellerId, productId: productId ?? null },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type,
        buyerId: sellerThread ? null : userId,
        sellerId,
        adminId,
        productId: productId ?? null,
        orderId: orderId ?? null,
      },
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    text: string,
    attachment?: string | null,
  ): Promise<Message> {
    if (!text.trim() && !attachment) throw badInput('Message is empty.');

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { seller: true },
    });
    if (!conversation) throw badInput('Conversation not found.');
    if (!this.isParticipant(conversation, userId))
      throw forbidden('You are not part of this conversation.');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        text: text.trim(),
        attachment: attachment ?? null,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.pubSub.publish(EVENTS.MESSAGE_ADDED, {
      messageAdded: message,
      conversationId,
    });

    /* Notify whoever is on the thread and is not the sender. A SELLER_ADMIN
       thread has no buyer at all, so "the other party" has to be found
       generally rather than assumed to be buyer-versus-everyone-else. */
    const recipientId =
      [
        conversation.buyerId,
        conversation.seller?.userId ?? null,
        conversation.adminId,
      ].find((id): id is string => Boolean(id) && id !== userId) ?? null;

    if (recipientId) {
      // a seller reads their messages in the dashboard, not the storefront
      const link =
        recipientId === conversation.seller?.userId
          ? `/dashboard/messages?c=${conversationId}`
          : `/account/messages?c=${conversationId}`;

      await this.notifications.notify(recipientId, {
        type: 'MESSAGE',
        title: 'New message',
        body: text.trim().slice(0, 80),
        link,
      });
    }

    return message;
  }

  async markAsRead(userId: string, conversationId: string): Promise<boolean> {
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  }
}
