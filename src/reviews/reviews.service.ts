import { Injectable } from '@nestjs/common';
import type { Review } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { badInput, forbidden } from '../common/errors';
import { round2 } from '../common/pricing';
import { pageInfo, paginate } from '../common/pagination';
import type { ReviewConnection } from './models/review.model';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Page of reviews plus the rating average and 1..5 star histogram. */
  async listForProduct(
    productId: string,
    page?: number | null,
    pageSize?: number | null,
  ): Promise<ReviewConnection> {
    const where = { productId };
    const { skip, take, page: safePage, pageSize: safeSize } = paginate(
      page,
      pageSize,
    );

    const [total, items, all] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.findMany({ where, select: { rating: true } }),
    ]);

    const distribution = [1, 2, 3, 4, 5].map(
      (star) => all.filter((r) => r.rating === star).length,
    );
    const average =
      all.length > 0
        ? round2(all.reduce((sum, r) => sum + r.rating, 0) / all.length)
        : 0;

    return {
      items: items as unknown as ReviewConnection['items'],
      pageInfo: pageInfo(total, safePage, safeSize),
      average,
      distribution,
    };
  }

  /** Verified-purchase reviews only: one per order item, after completion. */
  async create(
    userId: string,
    orderItemId: string,
    rating: number,
    text: string,
    images?: string[] | null,
  ): Promise<Review> {
    if (rating < 1 || rating > 5) throw badInput('Rating must be 1–5.');

    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { sellerOrder: { include: { order: true } }, review: true },
    });
    if (!orderItem || orderItem.sellerOrder.order.userId !== userId)
      throw forbidden('You can only review products you purchased.');
    if (orderItem.sellerOrder.order.status !== 'COMPLETED')
      throw forbidden('You can review after your order is completed.');
    if (orderItem.review)
      throw badInput('You already reviewed this order item.');

    const review = await this.prisma.review.create({
      data: {
        productId: orderItem.productId,
        userId,
        orderItemId,
        rating,
        text,
        images: (images ?? []).join(','),
        verified: true,
      },
    });

    await this.syncProductRating(orderItem.productId);
    return review;
  }

  /** Keeps the denormalized product rating/count in step with its reviews. */
  private async syncProductRating(productId: string): Promise<void> {
    const stats = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: round2(stats._avg.rating ?? 0),
        reviewsCount: stats._count,
      },
    });
  }
}
