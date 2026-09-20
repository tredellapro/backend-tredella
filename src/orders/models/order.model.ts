import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { Mode } from '../../common/enums';
import { Address } from '../../users/models/address.model';
import { Product } from '../../catalog/models/product.model';
import { Seller } from '../../sellers/models/seller.model';

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id!: string;

  @Field(() => Product)
  product!: Product;

  @Field()
  name!: string;

  @Field()
  image!: string;

  @Field(() => Mode)
  mode!: Mode;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  total!: number;

  @Field({ description: 'True if the buyer can review this item now' })
  reviewable!: boolean;
}

@ObjectType()
export class SellerOrder {
  @Field(() => ID)
  id!: string;

  @Field(() => Seller)
  seller!: Seller;

  @Field()
  status!: string;

  @Field(() => Float)
  subtotal!: number;

  @Field(() => [OrderItem])
  items!: OrderItem[];
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string;

  @Field(() => Mode)
  mode!: Mode;

  @Field()
  status!: string;

  @Field(() => Float)
  total!: number;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;

  @Field(() => Address, { nullable: true })
  address!: Address | null;

  @Field(() => [SellerOrder])
  sellerOrders!: SellerOrder[];
}
