import { Injectable } from '@nestjs/common';
import type { Prisma, Seller } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { badInput } from '../common/errors';
import type { SellerDocumentType } from '../common/constants';
import {
  approvalProblem,
  isoDay,
  missingDocuments,
  nextStatuses,
} from '../sellers/verification-rules';

/**
 * Reviewing a seller's UAE trade registration.
 *
 * The seller app has collected licences, Emirates IDs and VAT certificates
 * since registration shipped, and `verificationStatus` has sat on PENDING ever
 * since because nothing on either side could move it. This is that side.
 */

export type VerificationDecision = 'APPROVED' | 'REJECTED';

type SellerWithDocuments = Prisma.SellerGetPayload<{
  include: { documents: true };
}>;

@Injectable()
export class AdminSellersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The review queue. Waiting first, then oldest submission first, so it
   * drains in the order sellers have been waiting rather than alphabetically.
   */
  async list(status?: string | null): Promise<SellerWithDocuments[]> {
    const rows = await this.prisma.seller.findMany({
      where: status ? { verificationStatus: status } : {},
      include: { documents: { orderBy: { uploadedAt: 'asc' } } },
      orderBy: { submittedAt: 'asc' },
    });

    const waiting = (seller: Seller) =>
      seller.verificationStatus === 'PENDING' ? 0 : 1;
    return rows.sort((a, b) => waiting(a) - waiting(b));
  }

  countAwaitingReview(): Promise<number> {
    return this.prisma.seller.count({
      where: { verificationStatus: 'PENDING' },
    });
  }

  private async requireSeller(sellerId: string): Promise<SellerWithDocuments> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      include: { documents: true },
    });
    if (!seller) throw badInput('That store no longer exists.');
    return seller;
  }

  /**
   * Approve or reject.
   *
   * The same checks the admin console runs before it offers the button, run
   * again here — the console's copy shapes the UI, this one is the boundary.
   */
  async review(
    sellerId: string,
    status: VerificationDecision,
    note?: string | null,
  ): Promise<SellerWithDocuments> {
    const seller = await this.requireSeller(sellerId);
    const reason = note?.trim() ?? '';

    if (!nextStatuses(seller.verificationStatus).includes(status))
      throw badInput(
        `A ${seller.verificationStatus.toLowerCase()} registration cannot be set to ${status.toLowerCase()}.`,
      );

    if (status === 'REJECTED' && reason.length === 0)
      throw badInput('Give the seller a reason so they know what to fix.');

    if (status === 'APPROVED') {
      const problem = approvalProblem(
        {
          verificationStatus: seller.verificationStatus,
          trn: seller.trn,
          tradeLicenseExpiry: seller.tradeLicenseExpiry,
          documents: seller.documents.map(
            (document) => document.type as SellerDocumentType,
          ),
        },
        isoDay(new Date()),
      );
      if (problem) throw badInput(problem);
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        verificationStatus: status,
        /* `verified` is the badge buyers see; it must never be true for a
           store that is not currently approved. */
        verified: status === 'APPROVED',
        verificationNote: status === 'REJECTED' ? reason : null,
        reviewedAt: new Date(),
      },
      include: { documents: true },
    });

    if (seller.userId)
      await this.notifications.notify(seller.userId, {
        type: 'SYSTEM',
        title:
          status === 'APPROVED'
            ? 'Your store is verified'
            : 'Your registration needs attention',
        body:
          status === 'APPROVED'
            ? 'Buyers will see the verified mark on your store.'
            : reason,
        link: '/dashboard/settings',
      });

    return updated;
  }

  /**
   * Remove a document an admin has found a problem with.
   *
   * This is the only way a seller gets an upload slot back — their dashboard
   * offers upload only where a slot is empty, and `saveDocument` refuses to
   * replace a document that is already on file. The seller cannot do this
   * themselves once approved, by design.
   *
   * Removing something required from an approved store drops it back to
   * PENDING: leaving it verified would mean a store trading on a document an
   * admin has just called wrong.
   */
  async removeDocument(
    sellerId: string,
    type: SellerDocumentType,
    note?: string | null,
  ): Promise<SellerWithDocuments> {
    const seller = await this.requireSeller(sellerId);
    const document = seller.documents.find((entry) => entry.type === type);
    if (!document)
      throw badInput('There is no document of that type on this store.');

    await this.prisma.sellerDocument.delete({ where: { id: document.id } });
    /* Best effort: a storage object left behind is untidy, a failed request
       here would be worse — the row is already gone either way. */
    await this.storage.remove(document.url).catch(() => undefined);

    const remaining = seller.documents
      .filter((entry) => entry.id !== document.id)
      .map((entry) => entry.type as SellerDocumentType);

    const nowIncomplete =
      missingDocuments(seller.trn, remaining).length > 0;

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data:
        seller.verificationStatus === 'APPROVED' && nowIncomplete
          ? {
              verificationStatus: 'PENDING',
              verified: false,
              verificationNote: note?.trim() || null,
            }
          : { verificationNote: note?.trim() || seller.verificationNote },
      include: { documents: true },
    });

    if (seller.userId)
      await this.notifications.notify(seller.userId, {
        type: 'SYSTEM',
        title: 'A document needs replacing',
        body:
          note?.trim() ||
          'Tredella removed one of your documents. Upload a replacement from Settings.',
        link: '/dashboard/settings',
      });

    return updated;
  }
}
