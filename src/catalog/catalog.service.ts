import { Injectable } from '@nestjs/common';
import type { Category, Product, Subcategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Mode, SortBy } from '../common/enums';
import { badInput } from '../common/errors';
import {
  round2,
  unitPriceFor,
  type ProductWithTiers,
} from '../common/pricing';
import { pageInfo, paginate } from '../common/pagination';
import { buildOrderBy, buildProductWhere, modeWhere } from './product-query';
import type { ProductFilterInput } from './dto/product-filter.input';
import type {
  PriceQuote,
  ProductConnection,
} from './models/product-connection.model';
import type { HomePageData } from './models/home-page-data.model';

const FACET_SAMPLE_LIMIT = 2000; // cap facet aggregation work per query

/** A product referenced by its id or its public slug. */
export type ProductRef = {
  productId?: string | null;
  productSlug?: string | null;
};

export type ProductQueryArgs = {
  mode: Mode;
  filter?: ProductFilterInput | null;
  sortBy?: SortBy | null;
  page?: number | null;
  pageSize?: number | null;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------- categories ---------------- */

  getCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  getCategory(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  async getSubcategory(
    categorySlug: string,
    slug: string,
  ): Promise<Subcategory | null> {
    const category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    if (!category) return null;
    return this.prisma.subcategory.findUnique({
      where: { categoryId_slug: { categoryId: category.id, slug } },
    });
  }

  countProducts(
    key: 'categoryId' | 'subcategoryId',
    id: string,
    mode: Mode,
  ): Promise<number> {
    return this.prisma.product.count({
      where: { [key]: id, ...modeWhere(mode) },
    });
  }

  /* ---------------- products ---------------- */

  getProduct(slug: string, mode: Mode): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: { slug, ...modeWhere(mode) },
    });
  }

  /** Cart and wishlist accept either the id or the public slug. */
  private refWhere({ productId, productSlug }: ProductRef): {
    id?: string;
    slug?: string;
  } {
    if (!productId && !productSlug)
      throw badInput('A productId or productSlug is required.');
    return productId ? { id: productId } : { slug: productSlug! };
  }

  async findByRef(ref: ProductRef): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: this.refWhere(ref),
    });
    if (!product) throw badInput('Product not found.');
    return product;
  }

  async findByRefWithTiers(ref: ProductRef): Promise<ProductWithTiers> {
    const product = await this.prisma.product.findFirst({
      where: this.refWhere(ref),
      include: { priceTiers: true },
    });
    if (!product) throw badInput('Product not found.');
    return product;
  }

  /** Paginated product query plus dynamic facets for the filtered set. */
  async queryProducts(args: ProductQueryArgs): Promise<ProductConnection> {
    const { page, pageSize, skip, take } = paginate(args.page, args.pageSize);
    const where = buildProductWhere(args.mode, args.filter);
    const orderBy = buildOrderBy(args.sortBy ?? SortBy.RELEVANCE, args.mode);

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, orderBy, skip, take }),
    ]);

    // Facets: brands, price range and dynamic attributes over the filtered set
    const facetRows = await this.prisma.product.findMany({
      where,
      select: {
        brand: true,
        retailPrice: true,
        wholesaleFrom: true,
        attributes: { select: { name: true, value: true } },
      },
      take: FACET_SAMPLE_LIMIT,
    });

    const brandSet = new Set<string>();
    const facetMap = new Map<string, Map<string, number>>();
    let min = Infinity;
    let max = 0;
    for (const row of facetRows) {
      if (row.brand) brandSet.add(row.brand);
      const price =
        args.mode === Mode.WHOLESALE
          ? (row.wholesaleFrom ?? row.retailPrice)
          : row.retailPrice;
      min = Math.min(min, price);
      max = Math.max(max, price);
      for (const attr of row.attributes) {
        if (attr.name === 'Brand') continue; // brands surfaced separately
        const values = facetMap.get(attr.name) ?? new Map<string, number>();
        values.set(attr.value, (values.get(attr.value) ?? 0) + 1);
        facetMap.set(attr.name, values);
      }
    }

    return {
      items: items as unknown as ProductConnection['items'],
      pageInfo: pageInfo(total, page, pageSize),
      facets: [...facetMap.entries()].map(([name, values]) => ({
        name,
        values: [...values.entries()].map(([value, count]) => ({
          value,
          count,
        })),
      })),
      brands: [...brandSet].sort(),
      priceRange: { min: Number.isFinite(min) ? min : 0, max },
    };
  }

  /** Server-side price quote — the same code path order creation uses. */
  async getPriceQuote(
    productId: string,
    quantity: number,
    mode: Mode,
  ): Promise<PriceQuote> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { priceTiers: true },
    });
    if (!product) throw badInput('Product not found.');
    const unitPrice = unitPriceFor(product, quantity, mode);
    return { quantity, unitPrice, total: round2(unitPrice * quantity), mode };
  }

  /** Same subcategory first, topped up from the wider category. */
  async getRelatedProducts(
    productId: string,
    mode: Mode,
    limit: number,
  ): Promise<Product[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return [];
    const base = { ...modeWhere(mode), id: { not: product.id } };

    const related = await this.prisma.product.findMany({
      where: { ...base, subcategoryId: product.subcategoryId },
      orderBy: { sold: 'desc' },
      take: limit,
    });
    if (related.length < limit) {
      const fill = await this.prisma.product.findMany({
        where: {
          ...base,
          categoryId: product.categoryId,
          id: { notIn: [product.id, ...related.map((p) => p.id)] },
        },
        orderBy: { sold: 'desc' },
        take: limit - related.length,
      });
      related.push(...fill);
    }
    return related;
  }

  async getHomePageData(mode: Mode): Promise<HomePageData> {
    const base = modeWhere(mode);
    const [flashDeals, topRated, newArrivals, bigDiscounts, categories] =
      await Promise.all([
        this.prisma.product.findMany({
          where: { ...base, oldPrice: { not: null } },
          orderBy: { sold: 'desc' },
          take: 8,
        }),
        this.prisma.product.findMany({
          where: base,
          orderBy: [{ rating: 'desc' }, { reviewsCount: 'desc' }],
          take: 4,
        }),
        this.prisma.product.findMany({
          where: base,
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        this.prisma.product.findMany({
          where: { ...base, oldPrice: { not: null } },
          orderBy: { retailPrice: 'asc' },
          take: 8,
        }),
        this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
      ]);

    return {
      heroProducts: flashDeals.slice(0, 2),
      flashDeals,
      topRated,
      newArrivals,
      bigDiscounts,
      categories,
    } as unknown as HomePageData;
  }

  /** Product-name suggestions, ranked prefix-first. */
  async searchSuggestions(query: string, mode: Mode): Promise<string[]> {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    const products = await this.prisma.product.findMany({
      where: {
        ...modeWhere(mode),
        OR: [{ name: { contains: term } }, { brand: { contains: term } }],
      },
      select: { name: true, brand: true, sold: true },
      orderBy: { sold: 'desc' },
      take: 40,
    });

    // rank: name starts with term → a word starts with term → contains
    const rank = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower.startsWith(term)) return 0;
      if (lower.split(/[^a-z0-9]+/).some((w) => w.startsWith(term))) return 1;
      return 2;
    };

    return [...new Set(products.map((p) => p.name))]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }
}
