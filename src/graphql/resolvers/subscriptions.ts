import { withFilter } from "graphql-subscriptions";
import { EVENTS, type Context } from "../../context.js";

export const Subscription = {
  messageAdded: {
    subscribe: withFilter(
      (_: unknown, __: unknown, ctx: Context) =>
        ctx.pubsub.asyncIterator(EVENTS.MESSAGE_ADDED),
      (
        payload: { conversationId: string },
        variables: { conversationId: string }
      ) => payload.conversationId === variables.conversationId
    ),
  },

  notificationAdded: {
    subscribe: withFilter(
      (_: unknown, __: unknown, ctx: Context) =>
        ctx.pubsub.asyncIterator(EVENTS.NOTIFICATION_ADDED),
      (payload: { userId: string }, _: unknown, ctx: Context) =>
        ctx.user?.userId === payload.userId
    ),
  },
};
