import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CartResolver } from './cart.resolver';
import { CartService } from './cart.service';

@Module({
  imports: [CatalogModule],
  providers: [CartResolver, CartService],
  exports: [CartService],
})
export class CartModule {}
