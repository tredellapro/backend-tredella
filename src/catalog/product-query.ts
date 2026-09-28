import type { Prisma } from '@prisma/client';
import { Mode, SortBy } from '../common/enums';
import type { ProductFilterInput } from './dto/product-filter.input';

/**
 * Products a storefront mode is allowed to list.
 *
 * This is the single place buyer-facing visibility is decided — every public
 * product path funnels through it — so the admin's approval check belongs
 * here rather than being repeated at each call site and forgotten at one.
 *
 * A listing a seller saves is PENDING until an admin reviews it. Before this
 * existed, anything a seller typed was live on the storefront immediately.
 */
export const APPROVED = 'APPROVED';

export const modeWhere = (mode: Mode): Prisma.ProductWhereInput => ({
  approvalStatus: APPROVED,
  ...(mode === Mode.WHOLESALE
    ? { availableWholesale: true }
    : { availableRetail: true })
});

export const buildProductWhere = (
  mode: Mode,
  filter?: ProductFilterInput | null,
): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = { ...modeWhere(mode) };
  if (!filter) return where;

  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search } },
      { sku: { contains: filter.search } },
      { brand: { contains: filter.search } },
      { description: { contains: filter.search } },
      { seller: { name: { contains: filter.search } } },
      { subcategory: { name: { contains: filter.search } } },
    ];
  }
  if (filter.categorySlug) where.category = { slug: filter.categorySlug };
  if (filter.subcategorySlug)
    where.subcategory = { slug: filter.subcategorySlug };
  if (filter.sellerSlug) where.seller = { slug: filter.sellerSlug };
  if (filter.brands?.length) where.brand = { in: filter.brands };
  if (filter.minRating != null) where.rating = { gte: filter.minRating };
  if (filter.inStock) where.stock = { gt: 0 };
  if (filter.maxMoq != null && filter.maxMoq > 0)
    where.minOrder = { lte: filter.maxMoq };
  if (filter.onSale && mode === Mode.RETAIL) where.oldPrice = { not: null };

  const priceField = mode === Mode.WHOLESALE ? 'wholesaleFrom' : 'retailPrice';
  if (filter.priceMin != null || filter.priceMax != null) {
    where[priceField] = {
      ...(filter.priceMin != null ? { gte: filter.priceMin } : {}),
      ...(filter.priceMax != null ? { lte: filter.priceMax } : {}),
    };
  }

  // Dynamic attribute filters: every selected attribute must match one of its values
  if (filter.attributes?.length) {
    where.AND = filter.attributes.map((attr) => ({
      attributes: { some: { name: attr.name, value: { in: attr.values } } },
    }));
  }

  return where;
};

export const buildOrderBy = (
  sortBy: SortBy,
  mode: Mode,
): Prisma.ProductOrderByWithRelationInput[] => {
  const priceField = mode === Mode.WHOLESALE ? 'wholesaleFrom' : 'retailPrice';
  switch (sortBy) {
    case SortBy.NEWEST:
      return [{ createdAt: 'desc' }];
    case SortBy.PRICE_ASC:
      return [{ [priceField]: 'asc' }];
    case SortBy.PRICE_DESC:
      return [{ [priceField]: 'desc' }];
    case SortBy.BEST_RATED:
      return [{ rating: 'desc' }, { reviewsCount: 'desc' }];
    case SortBy.MOST_POPULAR:
      return [{ sold: 'desc' }];
    case SortBy.LOWEST_WHOLESALE_PRICE:
      return [{ wholesaleFrom: 'asc' }];
    case SortBy.BEST_BULK_DISCOUNT:
      // best (retail - wholesale) gap approximated by cheapest wholesale first;
      // exact expression sorting needs a computed column
      return [{ wholesaleFrom: 'asc' }, { retailPrice: 'desc' }];
    default:
      return [{ sold: 'desc' }, { createdAt: 'desc' }];
  }
};
