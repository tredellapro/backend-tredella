import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { Seller } from '../../sellers/models/seller.model';
import { Category, Subcategory } from './category.model';

@ObjectType()
export class PriceTier {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  minQty!: number;

  @Field(() => Int, { nullable: true })
  maxQty!: number | null;

  @Field(() => Float)
  price!: number;
}

@ObjectType()
export class ProductAttribute {
  @Field()
  name!: string;

  @Field()
  value!: string;
}

@ObjectType()
export class ProductImage {
  @Field(() => ID)
  id!: string;

  @Field()
  url!: string;

  @Field(() => Int)
  position!: number;
}

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  image!: string;

  @Field(() => [ProductImage])
  images!: ProductImage[];

  @Field(() => String, { nullable: true })
  brand!: string | null;

  @Field(() => Category)
  category!: Category;

  @Field(() => Subcategory)
  subcategory!: Subcategory;

  @Field(() => Seller)
  seller!: Seller;

  @Field(() => Float)
  retailPrice!: number;

  @Field(() => Float, { nullable: true })
  oldPrice!: number | null;

  @Field(() => [PriceTier])
  priceTiers!: PriceTier[];

  @Field(() => Float, {
    nullable: true,
    description: 'Cheapest wholesale per-unit price (highest tier)',
  })
  wholesaleFrom!: number | null;

  @Field(() => Int)
  minOrder!: number;

  @Field(() => Int)
  stock!: number;

  @Field()
  inStock!: boolean;

  @Field()
  availableRetail!: boolean;

  @Field()
  availableWholesale!: boolean;

  @Field(() => Float)
  rating!: number;

  @Field(() => Int)
  reviewsCount!: number;

  @Field(() => Int)
  sold!: number;

  @Field()
  deliveryDays!: string;

  @Field()
  freeShipping!: boolean;

  @Field(() => [ProductAttribute])
  attributes!: ProductAttribute[];

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;
}
