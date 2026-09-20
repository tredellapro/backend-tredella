import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SellersResolver } from './sellers.resolver';
import { SellerAccountResolver } from './seller-account.resolver';
import { SellerAccountService } from './seller-account.service';

@Module({
  imports: [CatalogModule],
  providers: [SellersResolver, SellerAccountResolver, SellerAccountService],
  exports: [SellerAccountService],
})
export class SellersModule {}
