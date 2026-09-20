import { Injectable } from '@nestjs/common';
import type { WishlistItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService, type ProductRef } from '../catalog/catalog.service';
import type { Mode } from '../common/enums';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  list(userId: string, mode?: Mode | null): Promise<WishlistItem[]> {
    return this.prisma.wishlistItem.findMany({
      where: { userId, ...(mode ? { mode } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(
    userId: string,
    ref: ProductRef,
    mode: Mode,
  ): Promise<WishlistItem> {
    const product = await this.catalog.findByRef(ref);
    return this.prisma.wishlistItem.upsert({
      where: {
        userId_productId_mode: { userId, productId: product.id, mode },
      },
      create: { userId, productId: product.id, mode },
      update: {},
    });
  }

  async remove(userId: string, ref: ProductRef, mode: Mode): Promise<boolean> {
    const product = await this.catalog.findByRef(ref);
    await this.prisma.wishlistItem.deleteMany({
      where: { userId, productId: product.id, mode },
    });
    return true;
  }
}
