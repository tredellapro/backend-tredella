import { Field, ID, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { PublicUser } from '../../users/models/public-user.model';

@ObjectType()
export class Question {
  @Field(() => ID)
  id!: string;

  @Field()
  text!: string;

  @Field(() => String, { nullable: true })
  answer!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  answeredAt!: Date | null;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;

  @Field(() => PublicUser)
  user!: PublicUser;
}
