import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { PageInfo } from '../../common/models/page-info.model';
import { PublicUser } from '../../users/models/public-user.model';

@ObjectType()
export class Review {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  rating!: number;

  @Field()
  text!: string;

  @Field(() => [String])
  images!: string[];

  @Field()
  verified!: boolean;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;

  @Field(() => PublicUser)
  user!: PublicUser;
}

@ObjectType()
export class ReviewConnection {
  @Field(() => [Review])
  items!: Review[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => Float)
  average!: number;

  @Field(() => [Int], { description: 'Count per star rating 1..5' })
  distribution!: number[];
}
