import { Injectable } from '@nestjs/common';
import type { Question } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { badInput, forbidden } from '../common/errors';

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

  /**
   * Every question asked about this seller's products.
   *
   * Unanswered first and oldest first within that, because the queue a seller
   * works through is "who has been waiting longest", not "what is newest".
   */
  async listForSeller(
    userId: string,
    answered?: boolean | null,
  ): Promise<Question[]> {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw forbidden('You do not have a seller account.');

    return this.prisma.question.findMany({
      where: {
        product: { sellerId: seller.id },
        ...(answered === true ? { answer: { not: null } } : {}),
        ...(answered === false ? { answer: null } : {}),
      },
      orderBy: [{ answeredAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Only the seller who owns the product may answer, and only once. */
  async answer(
    userId: string,
    questionId: string,
    answer: string,
  ): Promise<Question> {
    const trimmed = answer.trim();
    if (trimmed.length < 2) throw badInput('Write an answer first.');

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { product: { include: { seller: true } } },
    });
    if (!question) throw badInput('Question not found.');

    if (question.product.seller.userId !== userId)
      throw forbidden('That question is about someone else’s product.');

    const saved = await this.prisma.question.update({
      where: { id: questionId },
      data: { answer: trimmed, answeredAt: new Date() },
    });

    /* Tell the person who asked. They are on the storefront, so the link goes
       to the product page their question is sitting under. */
    await this.notifications.notify(question.userId, {
      type: 'SYSTEM',
      title: 'Your question was answered',
      body: `${question.product.name}: "${trimmed.slice(0, 80)}"`,
      link: `/product/${question.product.slug}`,
    });

    return saved;
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

    /* The seller answers from the Seller Dashboard, so the link has to point
       there — it was sending them to the buyer storefront, where there is
       nothing they can do about it. */
    if (product.seller.userId) {
      await this.notifications.notify(product.seller.userId, {
        type: 'SYSTEM',
        title: 'New question about your product',
        body: `${product.name}: "${text.trim().slice(0, 80)}"`,
        link: '/dashboard/products/questions',
      });
    }
    return question;
  }
}
