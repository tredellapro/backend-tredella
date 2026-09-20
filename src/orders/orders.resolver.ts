import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  Address as PrismaAddress,
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  Product as PrismaProduct,
  Seller as PrismaSeller,
  SellerOrder as PrismaSellerOrder,
} from '@prisma/client';
import { Order, OrderItem, SellerOrder } from './models/order.model';
import { Address } from '../users/models/address.model';
import { Product } from '../catalog/models/product.model';
import { Seller } from '../sellers/models/seller.model';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mode } from '../common/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import type { JwtPayload } from '../auth/token.service';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [Order])
  @UseGuards(GqlAuthGuard)
  getOrders(
    @CurrentUser() user: JwtPayload,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page?: number | null,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 10 })
    pageSize?: number | null,
  ): Promise<PrismaOrder[]> {
    return this.orders.list(user.userId, page, pageSize);
  }

  @Query(() => Order, { nullable: true })
  @UseGuards(GqlAuthGuard)
  getOrder(
    @CurrentUser() user: JwtPayload,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PrismaOrder | null> {
    return this.orders.findOne(user.userId, id);
  }

  @Mutation(() => Order)
  @UseGuards(GqlAuthGuard)
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Args('mode', { type: () => Mode }) mode: Mode,
    @Args('addressId', { type: () => ID, nullable: true })
    addressId?: string | null,
  ): Promise<PrismaOrder> {
    return this.orders.createOrder(user.userId, mode, addressId);
  }

  @ResolveField(() => Address, { nullable: true })
  address(@Parent() order: PrismaOrder): Promise<PrismaAddress | null> {
    if (!order.addressId) return Promise.resolve(null);
    return this.prisma.address.findUnique({ where: { id: order.addressId } });
  }

  @ResolveField(() => [SellerOrder])
  sellerOrders(@Parent() order: PrismaOrder): Promise<PrismaSellerOrder[]> {
    return this.prisma.order
      .findUnique({ where: { id: order.id } })
      .sellerOrders() as Promise<PrismaSellerOrder[]>;
  }
}

@Resolver(() => SellerOrder)
export class SellerOrdersResolver {
  constructor(private readonly prisma: PrismaService) {}

  @ResolveField(() => Seller)
  seller(@Parent() sellerOrder: PrismaSellerOrder): Promise<PrismaSeller> {
    return this.prisma.sellerOrder
      .findUnique({ where: { id: sellerOrder.id } })
      .seller() as Promise<PrismaSeller>;
  }

  @ResolveField(() => [OrderItem])
  items(@Parent() sellerOrder: PrismaSellerOrder): Promise<PrismaOrderItem[]> {
    return this.prisma.sellerOrder
      .findUnique({ where: { id: sellerOrder.id } })
      .items() as Promise<PrismaOrderItem[]>;
  }
}

@Resolver(() => OrderItem)
export class OrderItemsResolver {
  constructor(private readonly prisma: PrismaService) {}

  @ResolveField(() => Product)
  product(@Parent() item: PrismaOrderItem): Promise<PrismaProduct> {
    return this.prisma.orderItem
      .findUnique({ where: { id: item.id } })
      .product() as Promise<PrismaProduct>;
  }

  /** Reviewable once the whole order is completed and nothing is written yet. */
  @ResolveField(() => Boolean)
  async reviewable(@Parent() orderItem: PrismaOrderItem): Promise<boolean> {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItem.id },
      include: { sellerOrder: { include: { order: true } }, review: true },
    });
    return item?.sellerOrder.order.status === 'COMPLETED' && item.review == null;
  }
}
