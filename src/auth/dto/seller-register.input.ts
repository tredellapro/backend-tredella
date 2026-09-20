import { Field, InputType } from '@nestjs/graphql';

/** Mirrors the seller dashboard's Create Account form. */
@InputType()
export class SellerRegisterInput {
  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Country the store ships from, e.g. "Pakistan"',
  })
  country?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Public store name. Defaults to the seller\'s own name.',
  })
  storeName?: string | null;
}
