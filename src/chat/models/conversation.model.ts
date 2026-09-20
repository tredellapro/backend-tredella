import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { Product } from '../../catalog/models/product.model';
import { Seller } from '../../sellers/models/seller.model';
import { PublicUser } from '../../users/models/public-user.model';

@ObjectType()
export class Message {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  conversationId!: string;

  @Field(() => PublicUser)
  sender!: PublicUser;

  @Field()
  text!: string;

  @Field(() => String, { nullable: true })
  attachment!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  readAt!: Date | null;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;

  @Field()
  isMine!: boolean;
}

@ObjectType()
export class Conversation {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field(() => Seller, { nullable: true })
  seller!: Seller | null;

  @Field(() => Product, { nullable: true })
  product!: Product | null;

  @Field(() => String, { nullable: true })
  orderId!: string | null;

  @Field(() => Message, { nullable: true })
  lastMessage!: Message | null;

  @Field(() => Int)
  unreadCount!: number;

  @Field(() => String, { middleware: [isoDate] })
  updatedAt!: Date;
}
