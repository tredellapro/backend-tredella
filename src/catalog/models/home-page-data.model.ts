import { Field, ObjectType } from '@nestjs/graphql';
import { Category } from './category.model';
import { Product } from './product.model';

@ObjectType()
export class HomePageData {
  @Field(() => [Product])
  heroProducts!: Product[];

  @Field(() => [Product])
  flashDeals!: Product[];

  @Field(() => [Product])
  topRated!: Product[];

  @Field(() => [Product])
  newArrivals!: Product[];

  @Field(() => [Product])
  bigDiscounts!: Product[];

  @Field(() => [Category])
  categories!: Category[];
}
