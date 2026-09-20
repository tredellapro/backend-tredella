import { Injectable } from '@nestjs/common';
import type { CartItem, Order, PriceTier, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Mode } from '../common/enums';
import { badInput } from '../common/errors';
import { lineTotal, round2 } from '../common/pricing';
import { paginate } from '../common/pagination';

type PricedLine = {
  item: CartItem & { product: Product & { priceTiers: PriceTier[] } };
  unitPrice: number;
  total: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(
    userId: string,
    page?: number | null,
    pageSize?: number | null,
  ): Promise<Order[]> {
    const { skip, take } = paginate(page, pageSize);
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  findOne(userId: string, id: string): Promise<Order | null> {
    return this.prisma.order.findFirst({ where: { id, userId } });
  }

  /**
   * Checkout: one Order plus one SellerOrder per seller in the cart. Every line
   * is re-priced from the database — client-sent prices are never trusted.
   */
  async createOrder(
    userId: string,
    mode: Mode,
    addressId?: string | null,
  ): Promise<Order> {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId, mode },
      include: { product: { include: { priceTiers: true } } },
    });
    if (cartItems.length === 0) throw badInput('Your cart is empty.');

    if (addressId) {
      const address = await this.prisma.address.findFirst({
        where: { id: addressId, userId },
      });
      if (!address) throw badInput('Address not found.');
    }

    const lines: PricedLine[] = cartItems.map((item) => {
      const { unitPrice, total } = lineTotal(item.product, item.quantity, mode);
      return { item, unitPrice, total };
    });

    // group by seller → sub-orders
    const bySeller = new Map<string, PricedLine[]>();
    for (const line of lines) {
      const sellerId = line.item.product.sellerId;
      bySeller.set(sellerId, [...(bySeller.get(sellerId) ?? []), line]);
    }
    const orderTotal = round2(lines.reduce((sum, l) => sum + l.total, 0));

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          addressId: addressId ?? null,
          mode,
          status: 'PENDING',
          total: orderTotal,
        },
      });

      for (const [sellerId, sellerLines] of bySeller) {
        await tx.sellerOrder.create({
          data: {
            orderId: created.id,
            sellerId,
            status: 'PENDING',
            subtotal: round2(sellerLines.reduce((s, l) => s + l.total, 0)),
            items: {
              create: sellerLines.map(({ item, unitPrice, total }) => ({
                productId: item.productId,
                name: item.product.name,
                image: item.product.image,
                mode,
                quantity: item.quantity,
                unitPrice,
                total,
              })),
            },
          },
        });

        for (const { item } of sellerLines) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity },
              sold: { increment: item.quantity },
            },
          });
        }
      }

      await tx.cartItem.deleteMany({ where: { userId, mode } });
      return created;
    });

    await this.notifications.notify(userId, {
      type: 'ORDER_UPDATE',
      title: 'Order placed successfully',
      body: `Order #${order.id.slice(-8).toUpperCase()} — total AED ${orderTotal}`,
      link: `/account/orders/${order.id}`,
    });

    return order;
  }
}
