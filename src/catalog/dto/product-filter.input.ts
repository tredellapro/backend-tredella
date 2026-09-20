import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AttributeFilterInput {
  @Field()
  name!: string;

  @Field(() => [String])
  values!: string[];
}

@InputType()
export class ProductFilterInput {
  @Field(() => String, { nullable: true })
  search?: string | null;

  @Field(() => String, { nullable: true })
  categorySlug?: string | null;

  @Field(() => String, { nullable: true })
  subcategorySlug?: string | null;

  @Field(() => String, { nullable: true })
  sellerSlug?: string | null;

  @Field(() => [String], { nullable: true })
  brands?: string[] | null;

  @Field(() => Float, { nullable: true })
  priceMin?: number | null;

  @Field(() => Float, { nullable: true })
  priceMax?: number | null;

  @Field(() => Float, { nullable: true })
  minRating?: number | null;

  @Field(() => Boolean, { nullable: true })
  inStock?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  onSale?: boolean | null;

  @Field(() => Int, { nullable: true })
  maxMoq?: number | null;

  @Field(() => [AttributeFilterInput], { nullable: true })
  attributes?: AttributeFilterInput[] | null;
}
