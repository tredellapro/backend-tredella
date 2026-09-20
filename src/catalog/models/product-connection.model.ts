import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../common/models/page-info.model';
import { Mode } from '../../common/enums';
import { Product } from './product.model';

@ObjectType()
export class FacetValue {
  @Field()
  value!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class Facet {
  @Field()
  name!: string;

  @Field(() => [FacetValue])
  values!: FacetValue[];
}

@ObjectType()
export class PriceRange {
  @Field(() => Float)
  min!: number;

  @Field(() => Float)
  max!: number;
}

@ObjectType()
export class ProductConnection {
  @Field(() => [Product])
  items!: Product[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;

  @Field(() => [Facet], {
    description:
      'Dynamic facets for the current result set (attribute name -> values)',
  })
  facets!: Facet[];

  @Field(() => [String])
  brands!: string[];

  @Field(() => PriceRange)
  priceRange!: PriceRange;
}

@ObjectType({
  description: 'Quote for a quantity — calculated server-side from DB tiers',
})
export class PriceQuote {
  @Field(() => Int)
  quantity!: number;

  @Field(() => Float)
  unitPrice!: number;

  @Field(() => Float)
  total!: number;

  @Field(() => Mode)
  mode!: Mode;
}
