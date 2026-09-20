import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WishlistResolver } from './wishlist.resolver';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CatalogModule],
  providers: [WishlistResolver, WishlistService],
})
export class WishlistModule {}
