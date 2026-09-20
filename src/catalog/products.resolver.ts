import {
  Args,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  Category as PrismaCategory,
  PriceTier as PrismaPriceTier,
  Product as PrismaProduct,
  ProductAttribute as PrismaProductAttribute,
  ProductImage as PrismaProductImage,
  Seller as PrismaSeller,
  Subcategory as PrismaSubcategory,
} from '@prisma/client';
import {
  PriceTier,
  Product,
  ProductAttribute,
  ProductImage,
} from './models/product.model';
import {
  PriceQuote,
  ProductConnection,
} from './models/product-connection.model';
import { HomePageData } from './models/home-page-data.model';
import { Category, Subcategory } from './models/category.model';
import { Seller } from '../sellers/models/seller.model';
import { ProductFilterInput } from './dto/product-filter.input';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mode, SortBy } from '../common/enums';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  /* ---------------- queries ---------------- */

  @Query(() => HomePageData)
  getHomePageData(
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<HomePageData> {
    return this.catalog.getHomePageData(mode);
  }

  @Query(() => ProductConnection)
  getProducts(
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
    return this.catalog.queryProducts({ mode, filter, sortBy, page, pageSize });
  }

  @Query(() => Product, { nullable: true })
  getProduct(
    @Args('slug') slug: string,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<PrismaProduct | null> {
    return this.catalog.getProduct(slug, mode);
  }

  @Query(() => PriceQuote)
  getPriceQuote(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('quantity', { type: () => Int }) quantity: number,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<PriceQuote> {
    return this.catalog.getPriceQuote(productId, quantity, mode);
  }

  @Query(() => [Product])
  getRelatedProducts(
    @Args('productId', { type: () => ID }) productId: string,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 8 })
    limit?: number | null,
  ): Promise<PrismaProduct[]> {
    return this.catalog.getRelatedProducts(productId, mode, limit ?? 8);
  }

  @Query(() => [String])
  searchSuggestions(
    @Args('query') query: string,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<string[]> {
    return this.catalog.searchSuggestions(query, mode);
  }

  /* ---------------- field resolvers ---------------- */

  @ResolveField(() => Boolean)
  inStock(@Parent() product: PrismaProduct): boolean {
    return product.stock > 0;
  }

  @ResolveField(() => [ProductImage])
  async images(
    @Parent() product: PrismaProduct,
  ): Promise<PrismaProductImage[] | ProductImage[]> {
    const images = await this.prisma.product
      .findUnique({ where: { id: product.id } })
      .images({ orderBy: { position: 'asc' } });
    // a product always exposes at least its main image
    return images?.length
      ? images
      : [{ id: `${product.id}-main`, url: product.image, position: 0 }];
  }

  @ResolveField(() => Category)
  category(@Parent() product: PrismaProduct): Promise<PrismaCategory> {
    return this.prisma.product
      .findUnique({ where: { id: product.id } })
      .category() as Promise<PrismaCategory>;
  }

  @ResolveField(() => Subcategory)
  subcategory(@Parent() product: PrismaProduct): Promise<PrismaSubcategory> {
    return this.prisma.product
      .findUnique({ where: { id: product.id } })
      .subcategory() as Promise<PrismaSubcategory>;
  }

  @ResolveField(() => Seller)
  seller(@Parent() product: PrismaProduct): Promise<PrismaSeller> {
    return this.prisma.product
      .findUnique({ where: { id: product.id } })
      .seller() as Promise<PrismaSeller>;
  }

  @ResolveField(() => [PriceTier])
  priceTiers(@Parent() product: PrismaProduct): Promise<PrismaPriceTier[]> {
    return this.prisma.product
      .findUnique({ where: { id: product.id } })
      .priceTiers({ orderBy: { minQty: 'asc' } }) as Promise<PrismaPriceTier[]>;
  }

  @ResolveField(() => [ProductAttribute])
  attributes(
    @Parent() product: PrismaProduct,
  ): Promise<PrismaProductAttribute[]> {
    return this.prisma.product
      .findUnique({ where: { id: product.id } })
      .attributes() as Promise<PrismaProductAttribute[]>;
  }
}
