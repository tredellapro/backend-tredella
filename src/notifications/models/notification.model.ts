import { Field, ID, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';

@ObjectType()
export class Notification {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  body!: string | null;

  @Field(() => String, { nullable: true })
  link!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Thumbnail for the row; clients fall back to a type icon',
  })
  image!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  readAt!: Date | null;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;
}
