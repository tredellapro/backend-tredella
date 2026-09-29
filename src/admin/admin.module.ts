import { Module } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { AdminSellersService } from './admin-sellers.service';
import { AdminTeamService } from './admin-team.service';
import { AdminResolver } from './admin.resolver';
import { AdminSellersResolver } from './admin-sellers.resolver';
import { AdminTeamResolver } from './admin-team.resolver';
import { SuperAdminBootstrap } from './super-admin.bootstrap';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, NotificationsModule, StorageModule],
  providers: [
    AdminProductsService,
    AdminSellersService,
    AdminTeamService,
    AdminResolver,
    AdminSellersResolver,
    AdminTeamResolver,
    SuperAdminBootstrap
  ]
})
export class AdminModule {}
