import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  icon!: string | null;

  @Field(() => [Subcategory])
  subcategories!: Subcategory[];

  @Field(() => Int)
  productCount!: number;
}

@ObjectType()
export class Subcategory {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  name!: string;

  @Field(() => Category)
  category!: Category;

  @Field(() => Int)
  productCount!: number;
}
