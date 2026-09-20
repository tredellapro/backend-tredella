import { Injectable } from '@nestjs/common';
import type { Question } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { badInput } from '../common/errors';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  listForProduct(productId: string): Promise<Question[]> {
    return this.prisma.question.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ask(
    userId: string,
    productId: string,
    text: string,
  ): Promise<Question> {
    if (text.trim().length < 5) throw badInput('Question is too short.');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { seller: true },
    });
    if (!product) throw badInput('Product not found.');

    const question = await this.prisma.question.create({
      data: { productId, userId, text: text.trim() },
    });

    // the seller answers from the Seller Dashboard
    if (product.seller.userId) {
      await this.notifications.notify(product.seller.userId, {
        type: 'SYSTEM',
        title: 'New question about your product',
        body: `${product.name}: "${text.trim().slice(0, 80)}"`,
        link: `/product/${product.slug}`,
      });
    }
    return question;
  }
}
