import { Inject, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { PubSub } from 'graphql-subscriptions';
import { Notification } from './models/notification.model';
import { NotificationsService } from './notifications.service';
import { PUB_SUB } from '../common/pubsub/pubsub.module';
import { EVENTS } from '../common/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';
import type { GqlContext } from '../common/graphql-context';

@Resolver(() => Notification)
export class NotificationsResolver {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Query(() => [Notification])
  @UseGuards(GqlAuthGuard)
  getNotifications(
    @CurrentUser() user: JwtPayload,
    @Args('unreadOnly', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    unreadOnly?: boolean | null,
  ): Promise<Notification[]> {
    return this.notifications.list(user.userId, unreadOnly);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  markNotificationAsRead(
    @CurrentUser() user: JwtPayload,
    @Args('id', { type: () => ID, nullable: true }) id?: string | null,
  ): Promise<boolean> {
    return this.notifications.markAsRead(user.userId, id);
  }

  @Subscription(() => Notification, {
    filter: (
      payload: { userId: string },
      _variables: unknown,
      context: GqlContext,
    ) => context.user?.userId === payload.userId,
  })
  notificationAdded(): AsyncIterator<unknown> {
    return this.pubSub.asyncIterableIterator(EVENTS.NOTIFICATION_ADDED);
  }
}
