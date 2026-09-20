import { Field, ID, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { Mode } from '../../common/enums';
import { Product } from '../../catalog/models/product.model';

@ObjectType()
export class WishlistItem {
  @Field(() => ID)
  id!: string;

  @Field(() => Product)
  product!: Product;

  @Field(() => Mode)
  mode!: Mode;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;
}
