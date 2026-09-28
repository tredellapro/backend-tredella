import { Module } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { AdminResolver } from './admin.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [AdminProductsService, AdminResolver]
})
export class AdminModule {}
