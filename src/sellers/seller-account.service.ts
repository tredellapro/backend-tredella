import { Injectable } from '@nestjs/common';
import type { Seller, SellerDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { badInput, forbidden } from '../common/errors';
import { type SellerDocumentType } from '../common/constants';
import { missingDocuments } from './verification-rules';
import type { SellerAccount } from './models/seller-account.model';
import type { SellerVerificationInput } from './dto/seller-verification.input';
import {
  normaliseEmiratesId,
  normaliseTradeLicenseNumber,
  normaliseTrn,
  normaliseUaePhone,
  parseLicenseExpiry,
} from './seller-verification';

type SellerWithDocuments = Seller & { documents: SellerDocument[] };

@Injectable()
export class SellerAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** The signed-in user's store, or a clear error if they do not have one. */
  private async requireOwnStore(userId: string): Promise<SellerWithDocuments> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { documents: { orderBy: { uploadedAt: 'asc' } } },
    });
    if (!seller)
      throw forbidden('This account does not have a seller store attached.');
    return seller;
  }

  private toAccount(seller: SellerWithDocuments): SellerAccount {
    return {
      ...seller,
      /* Shared with the admin's approval check rather than a flat list of
         three: a VAT certificate is required only when the seller gave a TRN.
         Before this, a seller with a TRN and no certificate was told nothing
         was missing, then refused at review with no explanation. */
      missingDocuments: missingDocuments(
        seller.trn,
        seller.documents.map((document) => document.type as SellerDocumentType),
      ),
    } as unknown as SellerAccount;
  }

  async getMyAccount(userId: string): Promise<SellerAccount> {
    return this.toAccount(await this.requireOwnStore(userId));
  }

  /* ---------------- documents ---------------- */

  /**
   * One current file per type: re-uploading replaces the old one, and the
   * previous object is removed from storage so nothing is orphaned.
   *
   * On an APPROVED store a document that is on file cannot be swapped — that
   * is what makes the approval mean anything. An EMPTY slot is different: it
   * is empty because an admin took the document away for being wrong, or
   * because it was never required, and in both cases the seller is expected to
   * supply one. So the check is per document, not per store.
   */
  async saveDocument(
    userId: string,
    type: SellerDocumentType,
    file: Express.Multer.File,
  ): Promise<SellerDocument> {
    const seller = await this.requireOwnStore(userId);

    const previous = seller.documents.find((d) => d.type === type);

    if (seller.verificationStatus === 'APPROVED' && previous)
      throw badInput(
        'This document is already verified. Contact support to change it.',
      );

    const stored = await this.storage.upload(
      file,
      `seller-documents/${seller.id}`,
    );

    const saved = await this.prisma.sellerDocument.upsert({
      where: { sellerId_type: { sellerId: seller.id, type } },
      create: {
        sellerId: seller.id,
        type,
        url: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      update: {
        url: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date(),
      },
    });

    // best-effort; the new record is already the source of truth
    if (previous && previous.url !== stored.url)
      await this.storage.remove(this.storageKeyOf(previous.url));

    return saved;
  }

  async removeDocument(
    userId: string,
    type: SellerDocumentType,
  ): Promise<boolean> {
    const seller = await this.requireOwnStore(userId);
    if (seller.verificationStatus === 'APPROVED')
      throw badInput(
        'Your store is already verified. Contact support to change a document.',
      );

    const existing = seller.documents.find((d) => d.type === type);
    if (!existing) return true;

    await this.prisma.sellerDocument.delete({ where: { id: existing.id } });
    await this.storage.remove(this.storageKeyOf(existing.url));
    return true;
  }

  /** Storage keys are recoverable from the URL for both drivers. */
  private storageKeyOf(url: string): string {
    const disk = url.split('/uploads/')[1];
    if (disk) return disk;
    // Cloudinary: .../upload/v1699/tredella/seller-documents/<id>/<name>.<ext>
    const match = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
    return match?.[1] ?? url;
  }

  /* ---------------- submission ---------------- */

  /**
   * Validates the trade-registration details, checks every required document is
   * on file, and puts the store in the review queue.
   */
  async submitVerification(
    userId: string,
    input: SellerVerificationInput,
  ): Promise<SellerAccount> {
    const seller = await this.requireOwnStore(userId);

    if (seller.verificationStatus === 'PENDING')
      throw badInput('Your documents are already under review.');
    if (seller.verificationStatus === 'APPROVED')
      throw badInput('Your store is already verified.');

    const trn = normaliseTrn(input.trn);

    /* One check, not two: `missingDocuments` already knows a VAT certificate
       is required exactly when a TRN is given. The TRN here is the incoming
       one, since it is being set by this very call. */
    const missing = missingDocuments(
      trn,
      seller.documents.map((document) => document.type as SellerDocumentType),
    );
    if (missing.length)
      throw badInput(
        `Upload your ${missing.map(readableDocument).join(' and ')} before submitting.`,
      );

    const storeName = input.storeName.trim();
    const legalName = input.legalName.trim();
    if (!storeName) throw badInput('Enter the store name buyers will see.');
    if (!legalName) throw badInput('Enter the name on your trade licence.');

    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        name: storeName,
        legalName,
        legalForm: input.legalForm,
        emirate: input.emirate,
        addressLine: input.addressLine.trim(),
        phone: normaliseUaePhone(input.phone),
        tradeLicenseNumber: normaliseTradeLicenseNumber(
          input.tradeLicenseNumber,
        ),
        tradeLicenseExpiry: parseLicenseExpiry(input.tradeLicenseExpiry),
        emiratesIdNumber: normaliseEmiratesId(input.emiratesIdNumber),
        trn,
        // the emirate is what buyers see as the despatch origin
        shipsFrom: `${readableEmirate(input.emirate)}, UAE`,
        verificationStatus: 'PENDING',
        verificationNote: null,
        submittedAt: new Date(),
      },
      include: { documents: { orderBy: { uploadedAt: 'asc' } } },
    });

    return this.toAccount(updated);
  }
}

const readableDocument = (type: SellerDocumentType): string =>
  ({
    TRADE_LICENSE: 'trade licence',
    EMIRATES_ID_FRONT: 'Emirates ID (front)',
    EMIRATES_ID_BACK: 'Emirates ID (back)',
    VAT_CERTIFICATE: 'VAT certificate',
  })[type];

const readableEmirate = (emirate: string): string =>
  emirate
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
