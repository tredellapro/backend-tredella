import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { Mode } from '../../common/enums';
import { Product } from '../../catalog/models/product.model';
import { Seller } from '../../sellers/models/seller.model';

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id!: string;

  @Field(() => Product)
  product!: Product;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Mode)
  mode!: Mode;

  @Field(() => Float, {
    description: 'Current unit price for this quantity — server calculated',
  })
  unitPrice!: number;

  @Field(() => Float)
  total!: number;
}

@ObjectType()
export class SellerCartGroup {
  @Field(() => Seller)
  seller!: Seller;

  @Field(() => [CartItem])
  items!: CartItem[];

  @Field(() => Float)
  subtotal!: number;
}

@ObjectType()
export class Cart {
  @Field(() => [SellerCartGroup])
  groups!: SellerCartGroup[];

  @Field(() => Int)
  itemCount!: number;

  @Field(() => Float)
  total!: number;
}
