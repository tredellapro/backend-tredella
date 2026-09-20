import {
  Args,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type {
  Category as PrismaCategory,
  Subcategory as PrismaSubcategory,
} from '@prisma/client';
import { Category, Subcategory } from './models/category.model';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { Mode } from '../common/enums';

@Resolver(() => Category)
export class CategoriesResolver {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => [Category])
  getCategories(): Promise<PrismaCategory[]> {
    return this.catalog.getCategories();
  }

  @Query(() => Category, { nullable: true })
  getCategory(
    @Args('slug') slug: string,
  ): Promise<PrismaCategory | null> {
    return this.catalog.getCategory(slug);
  }

  @Query(() => Subcategory, { nullable: true })
  getSubcategory(
    @Args('categorySlug') categorySlug: string,
    @Args('slug') slug: string,
  ): Promise<PrismaSubcategory | null> {
    return this.catalog.getSubcategory(categorySlug, slug);
  }

  @ResolveField(() => [Subcategory])
  subcategories(@Parent() category: PrismaCategory): Promise<PrismaSubcategory[]> {
    return this.prisma.category
      .findUnique({ where: { id: category.id } })
      .subcategories() as Promise<PrismaSubcategory[]>;
  }

  @ResolveField(() => Int)
  productCount(
    @Parent() category: PrismaCategory,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<number> {
    return this.catalog.countProducts('categoryId', category.id, mode);
  }
}

@Resolver(() => Subcategory)
export class SubcategoriesResolver {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  @ResolveField(() => Category)
  category(@Parent() subcategory: PrismaSubcategory): Promise<PrismaCategory> {
    return this.prisma.subcategory
      .findUnique({ where: { id: subcategory.id } })
      .category() as Promise<PrismaCategory>;
  }

  @ResolveField(() => Int)
  productCount(
    @Parent() subcategory: PrismaSubcategory,
    @Args('mode', { type: () => Mode }) mode: Mode,
  ): Promise<number> {
    return this.catalog.countProducts('subcategoryId', subcategory.id, mode);
  }
}
