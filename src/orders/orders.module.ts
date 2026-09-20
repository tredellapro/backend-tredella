import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  OrderItemsResolver,
  OrdersResolver,
  SellerOrdersResolver,
} from './orders.resolver';
import { OrdersService } from './orders.service';

@Module({
  imports: [NotificationsModule],
  providers: [
    OrdersResolver,
    SellerOrdersResolver,
    OrderItemsResolver,
    OrdersService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
