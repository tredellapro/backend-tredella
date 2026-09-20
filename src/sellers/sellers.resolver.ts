import { Args, Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { Seller as PrismaSeller } from '@prisma/client';
import { Seller } from './models/seller.model';
import { ProductConnection } from '../catalog/models/product-connection.model';
import { ProductFilterInput } from '../catalog/dto/product-filter.input';
import { CatalogService } from '../catalog/catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mode, SortBy } from '../common/enums';

@Resolver(() => Seller)
export class SellersResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Query(() => Seller, { nullable: true })
  getSeller(@Args('slug') slug: string): Promise<PrismaSeller | null> {
    return this.prisma.seller.findUnique({ where: { slug } });
  }

  @Query(() => ProductConnection)
  getSellerProducts(
    @Args('sellerSlug') sellerSlug: string,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('filter', { type: () => ProductFilterInput, nullable: true })
    filter?: ProductFilterInput | null,
    @Args('sortBy', {
      type: () => SortBy,
      nullable: true,
      defaultValue: SortBy.RELEVANCE,
    })
    sortBy?: SortBy | null,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page?: number | null,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 12 })
    pageSize?: number | null,
  ): Promise<ProductConnection> {
    return this.catalog.queryProducts({
      mode,
      sortBy,
      page,
      pageSize,
      // the seller in the path always wins over one passed in the filter
      filter: { ...(filter ?? {}), sellerSlug },
    });
  }

  @ResolveField(() => Int)
  productCount(@Parent() seller: PrismaSeller): Promise<number> {
    return this.prisma.product.count({ where: { sellerId: seller.id } });
  }
}
