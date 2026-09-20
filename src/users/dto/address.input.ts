import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AddressInput {
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

  @Field(() => String, { nullable: true })
  country?: string | null;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean | null;
}
