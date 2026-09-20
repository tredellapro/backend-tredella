import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SellersResolver } from './sellers.resolver';

@Module({
  imports: [CatalogModule],
  providers: [SellersResolver],
})
export class SellersModule {}
