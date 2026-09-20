import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';

@ObjectType()
export class Seller {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  logo!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  verified!: boolean;

  @Field(() => Float)
  rating!: number;

  @Field(() => Float)
  positivePercent!: number;

  @Field(() => Int)
  followers!: number;

  @Field()
  shipsFrom!: string;

  @Field()
  deliveryEstimate!: string;

  @Field(() => Float, { nullable: true })
  freeShippingOver!: number | null;

  @Field(() => String, { middleware: [isoDate] })
  joinedAt!: Date;

  @Field(() => Int)
  productCount!: number;
}
