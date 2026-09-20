import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService, type ProductRef } from '../catalog/catalog.service';
import { Mode } from '../common/enums';
import { badInput } from '../common/errors';
import { lineTotal, round2 } from '../common/pricing';
import type { Cart, CartItem, SellerCartGroup } from './models/cart.model';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /** The cart for a mode, priced live from the database and grouped by seller. */
  async getCart(userId: string, mode: Mode): Promise<Cart> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId, mode },
      include: { product: { include: { priceTiers: true, seller: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, SellerCartGroup>();
    let total = 0;
    let itemCount = 0;

    for (const item of items) {
      const { unitPrice, total: itemTotal } = lineTotal(
        item.product,
        item.quantity,
        mode,
      );
      const entry = groups.get(item.product.sellerId) ?? {
        seller: item.product.seller as unknown as SellerCartGroup['seller'],
        items: [],
        subtotal: 0,
      };
      entry.items.push({
        ...item,
        unitPrice,
        total: itemTotal,
      } as unknown as CartItem);
      entry.subtotal = round2(entry.subtotal + itemTotal);
      groups.set(item.product.sellerId, entry);
      total = round2(total + itemTotal);
      itemCount += item.quantity;
    }

    return { groups: [...groups.values()], itemCount, total };
  }

  async addToCart(
    userId: string,
    ref: ProductRef,
    quantity: number,
    mode: Mode,
  ): Promise<Cart> {
    const product = await this.catalog.findByRefWithTiers(ref);
    // validates availability, MOQ, stock, and that pricing exists
    lineTotal(product, quantity, mode);

    await this.prisma.cartItem.upsert({
      where: {
        userId_productId_mode: { userId, productId: product.id, mode },
      },
      create: { userId, productId: product.id, quantity, mode },
      update: { quantity: { increment: quantity } },
    });
    return this.getCart(userId, mode);
  }

  /** A quantity of zero or less removes the line. */
  async updateCartItem(
    userId: string,
    cartItemId: string,
    quantity: number,
  ): Promise<Cart> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
      include: { product: { include: { priceTiers: true } } },
    });
    if (!item) throw badInput('Cart item not found.');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      lineTotal(item.product, quantity, item.mode as Mode);
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }
    return this.getCart(userId, item.mode as Mode);
  }

  async removeFromCart(userId: string, cartItemId: string): Promise<Cart> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, userId },
    });
    if (!item) throw badInput('Cart item not found.');
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId, item.mode as Mode);
  }
}
