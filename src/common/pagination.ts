import type { PageInfo } from './models/page-info.model';

/** Clamped page/pageSize plus the PageInfo the connections return. */
export const paginate = (
  page: number | null | undefined,
  pageSize: number | null | undefined,
  maxPageSize = 48,
): { page: number; pageSize: number; skip: number; take: number } => {
  const safePage = Math.max(1, page ?? 1);
  const safeSize = Math.min(maxPageSize, Math.max(1, pageSize ?? 12));
  return {
    page: safePage,
    pageSize: safeSize,
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  };
};

export const pageInfo = (
  total: number,
  page: number,
  pageSize: number,
): PageInfo => ({
  total,
  page,
  pageSize,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
  hasNextPage: page * pageSize < total,
});
