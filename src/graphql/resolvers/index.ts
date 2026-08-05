import { Query } from "./queries.js";
import { Mutation } from "./mutations.js";
import { Subscription } from "./subscriptions.js";
import { fieldResolvers } from "./fields.js";

export const resolvers = {
  Query,
  Mutation,
  Subscription,
  ...fieldResolvers,
};
