import { Module } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { AdminSellersService } from './admin-sellers.service';
import { AdminResolver } from './admin.resolver';
import { AdminSellersResolver } from './admin-sellers.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, NotificationsModule, StorageModule],
  providers: [
    AdminProductsService,
    AdminSellersService,
    AdminResolver,
    AdminSellersResolver
  ]
})
export class AdminModule {}
