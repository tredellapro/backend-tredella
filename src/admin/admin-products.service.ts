import { Injectable } from '@nestjs/common';
import type { Product, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { badInput } from '../common/errors';

/**
 * The admin side of product listings.
 *
 * Every other product query in the API is scoped — to a storefront mode, to a
 * seller's slug, to what a buyer may see. This one is deliberately unscoped
 * and guarded by role instead, because reviewing is the one job that needs to
 * see the listings nobody else can.
 */

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const PAGE_SIZE = 20;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Listings for review. Unreviewed first and oldest first inside that, so the
   * queue drains in the order sellers have been waiting.
   */
  async list(params: {
    status?: string | null;
    sellerId?: string | null;
    search?: string | null;
    page?: number | null;
    pageSize?: number | null;
  }): Promise<Product[]> {
    const { status, sellerId, search } = params;
    const page = Math.max(1, params.page ?? 1);
    const take = Math.min(100, Math.max(1, params.pageSize ?? PAGE_SIZE));

    const where: Prisma.ProductWhereInput = {};
    if (status) where.approvalStatus = status;
    if (sellerId) where.sellerId = sellerId;
    if (search)
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { seller: { name: { contains: search } } },
      ];

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * take,
      take,
    });

    /* Sorted in memory rather than by SQL: "PENDING first" is not alphabetical
       and Prisma cannot express a custom enum order on a String column. The
       page is at most 100 rows, so this costs nothing. */
    const waiting = (product: Product) =>
      product.approvalStatus === 'PENDING' ? 0 : 1;
    return rows.sort((a, b) => waiting(a) - waiting(b));
  }

  countAwaitingReview(): Promise<number> {
    return this.prisma.product.count({ where: { approvalStatus: 'PENDING' } });
  }

  /**
   * Approve or reject a listing.
   *
   * Approving clears it for sale; it does **not** switch on the seller's own
   * availability flags. If they had the product off for retail, it stays off —
   * an admin decision must not quietly change what the seller chose to sell.
   */
  async review(
    reviewerId: string,
    productId: string,
    status: ApprovalStatus,
    note?: string | null,
  ): Promise<Product> {
    if (status === 'PENDING')
      throw badInput(
        'PENDING is where a listing starts, not a decision. Approve or reject it.',
      );

    const reason = note?.trim() ?? '';
    if (status === 'REJECTED' && reason.length === 0)
      throw badInput('Give the seller a reason for the rejection.');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { userId: true, name: true } } },
    });
    if (!product) throw badInput('That product no longer exists.');

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        approvalStatus: status,
        approvalNote: status === 'REJECTED' ? reason : null,
        reviewedAt: new Date(),
      },
    });

    /* The seller has to find out without being told in person — this is the
       only signal that their listing went live, or did not. */
    if (product.seller?.userId)
      await this.notifications.notify(product.seller.userId, {
        // these two constants already existed, waiting for this feature
        type: status === 'APPROVED' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
        title:
          status === 'APPROVED'
            ? `${product.name} is approved`
            : `${product.name} was rejected`,
        body:
          status === 'APPROVED'
            ? 'It is on sale now, as long as you have it switched on.'
            : reason,
        link: `/dashboard/products/${product.id}`,
        image: product.image,
      });

    return updated;
  }
}
