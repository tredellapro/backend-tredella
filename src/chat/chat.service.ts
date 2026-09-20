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

  /** Reuses an existing thread for the same buyer/seller/product triple. */
  async startConversation(
    userId: string,
    type: string,
    sellerSlug?: string | null,
    productId?: string | null,
    orderId?: string | null,
  ): Promise<Conversation> {
    if (type !== 'BUYER_SELLER' && type !== 'BUYER_ADMIN')
      throw badInput('Buyers can start seller or admin conversations.');

    let sellerId: string | null = null;
    if (type === 'BUYER_SELLER') {
      if (!sellerSlug) throw badInput('sellerSlug is required.');
      const seller = await this.prisma.seller.findUnique({
        where: { slug: sellerSlug },
      });
      if (!seller) throw badInput('Seller not found.');
      sellerId = seller.id;
    }

    let adminId: string | null = null;
    if (type === 'BUYER_ADMIN') {
      const admin = await this.prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
      if (!admin) throw badInput('Support is not available right now.');
      adminId = admin.id;
    }

    const existing = await this.prisma.conversation.findFirst({
      where: { type, buyerId: userId, sellerId, productId: productId ?? null },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type,
        buyerId: userId,
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

    // notify the other party
    const recipientId =
      conversation.buyerId === userId
        ? (conversation.seller?.userId ?? conversation.adminId)
        : conversation.buyerId;
    if (recipientId) {
      await this.notifications.notify(recipientId, {
        type: 'MESSAGE',
        title: 'New message',
        body: text.trim().slice(0, 80),
        link: `/account/messages?c=${conversationId}`,
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
