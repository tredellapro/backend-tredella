import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SellerAccount } from '../sellers/models/seller-account.model';
import { AdminSellersService } from './admin-sellers.service';
import { VerificationDecision } from './verification-status.enum';
import { SellerDocumentType } from '../common/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { missingDocuments } from '../sellers/verification-rules';
import type { SellerDocumentType as DocType } from '../common/constants';

/**
 * Seller verification, from the reviewer's side.
 *
 * Returns the same SellerAccount type the seller sees of themselves — it
 * already carries the registration fields and the documents, and reusing it
 * means the console and the dashboard cannot disagree about the shape.
 */
@Resolver(() => SellerAccount)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSellersResolver {
  constructor(private readonly sellers: AdminSellersService) {}

  private withMissing(seller: {
    trn: string | null;
    documents: { type: string }[];
  }): SellerAccount {
    return {
      ...seller,
      missingDocuments: missingDocuments(
        seller.trn,
        seller.documents.map((document) => document.type as DocType),
      ),
    } as unknown as SellerAccount;
  }

  @Query(() => [SellerAccount], {
    description:
      'Seller trade registrations. Awaiting review first, then oldest submission first.',
  })
  async adminSellerRegistrations(
    @Args('status', { type: () => String, nullable: true })
    status?: string | null,
  ): Promise<SellerAccount[]> {
    const rows = await this.sellers.list(status);
    return rows.map((row) => this.withMissing(row));
  }

  @Query(() => Int, {
    description: 'Registrations waiting on a decision — drives the queue badge.',
  })
  adminSellersAwaitingReview(): Promise<number> {
    return this.sellers.countAwaitingReview();
  }

  @Mutation(() => SellerAccount, {
    description:
      'Approve or reject a trade registration. Approving is what puts the verified mark on a store.',
  })
  async reviewSellerRegistration(
    @Args('sellerId', { type: () => ID }) sellerId: string,
    @Args('status', { type: () => VerificationDecision })
    status: VerificationDecision,
    @Args('note', { type: () => String, nullable: true })
    note?: string | null,
  ): Promise<SellerAccount> {
    return this.withMissing(await this.sellers.review(sellerId, status, note));
  }

  @Mutation(() => SellerAccount, {
    description:
      "Remove a document that is wrong. This is the only way a seller gets an upload slot back — their own removeSellerDocument refuses once the store is approved.",
  })
  async removeSellerDocumentAsAdmin(
    @Args('sellerId', { type: () => ID }) sellerId: string,
    @Args('type', { type: () => SellerDocumentType }) type: SellerDocumentType,
    @Args('note', { type: () => String, nullable: true })
    note?: string | null,
  ): Promise<SellerAccount> {
    return this.withMissing(
      await this.sellers.removeDocument(sellerId, type as DocType, note),
    );
  }
}
