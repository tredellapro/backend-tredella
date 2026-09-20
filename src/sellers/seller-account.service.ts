import { Injectable } from '@nestjs/common';
import type { Seller, SellerDocument } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { badInput, forbidden } from '../common/errors';
import {
  REQUIRED_SELLER_DOCUMENTS,
  type SellerDocumentType,
} from '../common/constants';
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
    const present = new Set(seller.documents.map((d) => d.type));
    return {
      ...seller,
      missingDocuments: REQUIRED_SELLER_DOCUMENTS.filter(
        (type) => !present.has(type),
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
   */
  async saveDocument(
    userId: string,
    type: SellerDocumentType,
    file: Express.Multer.File,
  ): Promise<SellerDocument> {
    const seller = await this.requireOwnStore(userId);

    if (seller.verificationStatus === 'APPROVED')
      throw badInput(
        'Your store is already verified. Contact support to change a document.',
      );

    const stored = await this.storage.upload(
      file,
      `seller-documents/${seller.id}`,
    );

    const previous = seller.documents.find((d) => d.type === type);

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

    const present = new Set(seller.documents.map((d) => d.type));
    const missing = REQUIRED_SELLER_DOCUMENTS.filter((t) => !present.has(t));
    if (missing.length)
      throw badInput(
        `Upload your ${missing.map(readableDocument).join(' and ')} before submitting.`,
      );

    const trn = normaliseTrn(input.trn);
    // a VAT certificate without a number on it cannot be checked
    if (trn && !present.has('VAT_CERTIFICATE'))
      throw badInput(
        'You entered a TRN, so please also upload your VAT certificate.',
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
