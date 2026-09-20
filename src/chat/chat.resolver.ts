import { Inject, UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import type {
  Conversation as PrismaConversation,
  Message as PrismaMessage,
  Product as PrismaProduct,
  Seller as PrismaSeller,
  User as PrismaUser,
} from '@prisma/client';
import type { PubSub } from 'graphql-subscriptions';
import { Conversation, Message } from './models/conversation.model';
import { Product } from '../catalog/models/product.model';
import { Seller } from '../sellers/models/seller.model';
import { PublicUser } from '../users/models/public-user.model';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUB_SUB } from '../common/pubsub/pubsub.module';
import { EVENTS } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => Conversation)
export class ConversationsResolver {
  constructor(
    private readonly chat: ChatService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [Conversation])
  @UseGuards(GqlAuthGuard)
  getConversations(
    @CurrentUser() user: JwtPayload,
  ): Promise<PrismaConversation[]> {
    return this.chat.listConversations(user);
  }

  @Mutation(() => Conversation)
  @UseGuards(GqlAuthGuard)
  startConversation(
    @CurrentUser() user: JwtPayload,
    @Args('type') type: string,
    @Args('sellerSlug', { type: () => String, nullable: true })
    sellerSlug?: string | null,
    @Args('productId', { type: () => ID, nullable: true })
    productId?: string | null,
    @Args('orderId', { type: () => ID, nullable: true })
    orderId?: string | null,
  ): Promise<PrismaConversation> {
    return this.chat.startConversation(
      user.userId,
      type,
      sellerSlug,
      productId,
      orderId,
    );
  }

  @ResolveField(() => Seller, { nullable: true })
  seller(
    @Parent() conversation: PrismaConversation,
  ): Promise<PrismaSeller | null> {
    if (!conversation.sellerId) return Promise.resolve(null);
    return this.prisma.seller.findUnique({
      where: { id: conversation.sellerId },
    });
  }

  @ResolveField(() => Product, { nullable: true })
  product(
    @Parent() conversation: PrismaConversation,
  ): Promise<PrismaProduct | null> {
    if (!conversation.productId) return Promise.resolve(null);
    return this.prisma.product.findUnique({
      where: { id: conversation.productId },
    });
  }

  @ResolveField(() => Message, { nullable: true })
  lastMessage(
    @Parent() conversation: PrismaConversation,
  ): Promise<PrismaMessage | null> {
    return this.prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @ResolveField(() => Int)
  unreadCount(
    @Parent() conversation: PrismaConversation,
    @CurrentUser() user: JwtPayload | null,
  ): Promise<number> {
    if (!user) return Promise.resolve(0);
    return this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: user.userId },
        readAt: null,
      },
    });
  }
}

@Resolver(() => Message)
export class MessagesResolver {
  constructor(
    private readonly chat: ChatService,
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Query(() => [Message])
  @UseGuards(GqlAuthGuard)
  getMessages(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page?: number | null,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 30 })
    pageSize?: number | null,
  ): Promise<PrismaMessage[]> {
    return this.chat.listMessages(user, conversationId, page, pageSize);
  }

  @Mutation(() => Message)
  @UseGuards(GqlAuthGuard)
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId', { type: () => ID }) conversationId: string,
    @Args('text') text: string,
    @Args('attachment', { type: () => String, nullable: true })
    attachment?: string | null,
  ): Promise<PrismaMessage> {
    return this.chat.sendMessage(user.userId, conversationId, text, attachment);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  markMessageAsRead(
    @CurrentUser() user: JwtPayload,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ): Promise<boolean> {
    return this.chat.markAsRead(user.userId, conversationId);
  }

  @Subscription(() => Message, {
    filter: (
      payload: { conversationId: string },
      variables: { conversationId: string },
    ) => payload.conversationId === variables.conversationId,
  })
  messageAdded(
    @Args('conversationId', { type: () => ID }) _conversationId: string,
  ): AsyncIterator<unknown> {
    return this.pubSub.asyncIterableIterator(EVENTS.MESSAGE_ADDED);
  }

  @ResolveField(() => PublicUser)
  sender(@Parent() message: PrismaMessage): Promise<PrismaUser> {
    return this.prisma.message
      .findUnique({ where: { id: message.id } })
      .sender() as Promise<PrismaUser>;
  }

  /** Lets the client align a bubble left or right without knowing the user id. */
  @ResolveField(() => Boolean)
  isMine(
    @Parent() message: PrismaMessage,
    @CurrentUser() user: JwtPayload | null,
  ): boolean {
    return user?.userId === message.senderId;
  }
}

