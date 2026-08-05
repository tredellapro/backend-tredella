import type { Prisma } from "@prisma/client";
import type { Context } from "../../context.js";
import type { Mode } from "../../lib/constants.js";

export const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

export const modeWhere = (mode: Mode): Prisma.ProductWhereInput =>
  mode === "WHOLESALE"
    ? { availableWholesale: true }
    : { availableRetail: true };

export type ProductFilterInput = {
  search?: string | null;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  sellerSlug?: string | null;
  brands?: string[] | null;
  priceMin?: number | null;
  priceMax?: number | null;
  minRating?: number | null;
  inStock?: boolean | null;
  onSale?: boolean | null;
  maxMoq?: number | null;
  attributes?: { name: string; values: string[] }[] | null;
};

export const buildProductWhere = (
  mode: Mode,
  filter?: ProductFilterInput | null
): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = { ...modeWhere(mode) };
  if (!filter) return where;

  if (filter.search) {
    // SQLite LIKE is case-insensitive for ASCII; Postgres would use mode:"insensitive"
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
  if (filter.onSale && mode === "RETAIL") where.oldPrice = { not: null };

  const priceField = mode === "WHOLESALE" ? "wholesaleFrom" : "retailPrice";
  if (filter.priceMin != null || filter.priceMax != null) {
    where[priceField] = {
      ...(filter.priceMin != null ? { gte: filter.priceMin } : {}),
      ...(filter.priceMax != null ? { lte: filter.priceMax } : {}),
    };
  }

  // Dynamic attribute filters: every selected attribute must match one of its values
  if (filter.attributes?.length) {
    where.AND = filter.attributes.map((attr) => ({
      attributes: {
        some: { name: attr.name, value: { in: attr.values } },
      },
    }));
  }

  return where;
};

export type SortBy =
  | "RELEVANCE"
  | "NEWEST"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "BEST_RATED"
  | "MOST_POPULAR"
  | "LOWEST_WHOLESALE_PRICE"
  | "BEST_BULK_DISCOUNT";

export const buildOrderBy = (
  sortBy: SortBy,
  mode: Mode
): Prisma.ProductOrderByWithRelationInput[] => {
  const priceField = mode === "WHOLESALE" ? "wholesaleFrom" : "retailPrice";
  switch (sortBy) {
    case "NEWEST":
      return [{ createdAt: "desc" }];
    case "PRICE_ASC":
      return [{ [priceField]: "asc" }];
    case "PRICE_DESC":
      return [{ [priceField]: "desc" }];
    case "BEST_RATED":
      return [{ rating: "desc" }, { reviewsCount: "desc" }];
    case "MOST_POPULAR":
      return [{ sold: "desc" }];
    case "LOWEST_WHOLESALE_PRICE":
      return [{ wholesaleFrom: "asc" }];
    case "BEST_BULK_DISCOUNT":
      // best (retail - wholesale) gap approximated by cheapest wholesale first;
      // exact expression sorting comes with PostgreSQL (computed column)
      return [{ wholesaleFrom: "asc" }, { retailPrice: "desc" }];
    default:
      return [{ sold: "desc" }, { createdAt: "desc" }];
  }
};

const FACET_SAMPLE_LIMIT = 2000; // cap facet aggregation work per query

/** Paginated product query + dynamic facets for the filtered set. */
export const queryProducts = async (
  ctx: Context,
  args: {
    mode: Mode;
    filter?: ProductFilterInput | null;
    sortBy?: SortBy | null;
    page?: number | null;
    pageSize?: number | null;
  }
) => {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, args.pageSize ?? 12));
  const where = buildProductWhere(args.mode, args.filter);
  const orderBy = buildOrderBy(args.sortBy ?? "RELEVANCE", args.mode);

  const [total, items] = await Promise.all([
    ctx.prisma.product.count({ where }),
    ctx.prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Facets: brands, price range and dynamic attributes over the filtered set
  const facetRows = await ctx.prisma.product.findMany({
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
      args.mode === "WHOLESALE"
        ? (row.wholesaleFrom ?? row.retailPrice)
        : row.retailPrice;
    min = Math.min(min, price);
    max = Math.max(max, price);
    for (const attr of row.attributes) {
      if (attr.name === "Brand") continue; // brands surfaced separately
      const values = facetMap.get(attr.name) ?? new Map<string, number>();
      values.set(attr.value, (values.get(attr.value) ?? 0) + 1);
      facetMap.set(attr.name, values);
    }
  }

  return {
    items,
    pageInfo: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNextPage: page * pageSize < total,
    },
    facets: [...facetMap.entries()].map(([name, values]) => ({
      name,
      values: [...values.entries()].map(([value, count]) => ({ value, count })),
    })),
    brands: [...brandSet].sort(),
    priceRange: {
      min: Number.isFinite(min) ? min : 0,
      max,
    },
  };
};

/** Create + publish a notification. */
export const notify = async (
  ctx: Context,
  userId: string,
  data: { type: string; title: string; body?: string; link?: string }
) => {
  const notification = await ctx.prisma.notification.create({
    data: { userId, ...data },
  });
  await ctx.pubsub.publish("NOTIFICATION_ADDED", {
    notificationAdded: notification,
    userId,
  });
  return notification;
};
