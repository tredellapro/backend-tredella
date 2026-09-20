import { Field, ID, ObjectType } from '@nestjs/graphql';

/** The slice of a user that is safe to show next to reviews, questions and chat. */
@ObjectType()
export class PublicUser {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  avatar!: string | null;
}
