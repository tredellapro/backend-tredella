import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CategoriesResolver, SubcategoriesResolver } from './categories.resolver';
import { ProductsResolver } from './products.resolver';

@Module({
  providers: [
    CatalogService,
    CategoriesResolver,
    SubcategoriesResolver,
    ProductsResolver,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
