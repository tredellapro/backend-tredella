import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Address {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  @Field()
  fullName!: string;

  @Field()
  phone!: string;

  @Field()
  line1!: string;

  @Field()
  city!: string;

  @Field()
  country!: string;

  @Field()
  isDefault!: boolean;
}
