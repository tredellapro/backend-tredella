import { Inject, Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUB_SUB } from '../common/pubsub/pubsub.module';
import type { PubSub } from 'graphql-subscriptions';
import { EVENTS, type NotificationType } from '../common/constants';

export type NotifyInput = {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Thumbnail for the row — the product, the promotion artwork, and so on. */
  image?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** Create a notification and push it to the recipient's open sockets. */
  async notify(userId: string, data: NotifyInput): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: { userId, ...data },
    });
    await this.pubSub.publish(EVENTS.NOTIFICATION_ADDED, {
      notificationAdded: notification,
      userId,
    });
    return notification;
  }

  /** Drives the bell badge without fetching the list behind it. */
  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  list(
    userId: string,
    unreadOnly?: boolean | null,
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Marks one notification read, or every unread one when no id is given. */
  async markAsRead(userId: string, id?: string | null): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { userId, ...(id ? { id } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    return true;
  }
}
