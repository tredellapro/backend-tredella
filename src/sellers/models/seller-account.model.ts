import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import {
  Emirate,
  LegalForm,
  SellerDocumentType,
  VerificationStatus,
} from '../../common/enums';

@ObjectType({ description: 'A KYC file backing the seller registration.' })
export class SellerDocument {
  @Field(() => ID)
  id!: string;

  @Field(() => SellerDocumentType)
  type!: SellerDocumentType;

  @Field()
  url!: string;

  @Field()
  fileName!: string;

  @Field()
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;

  @Field(() => String, { middleware: [isoDate] })
  uploadedAt!: Date;
}

/**
 * The seller's own view of their store — trade licence, Emirates ID and review
 * state. Deliberately separate from the public `Seller` type so registration
 * details can never be selected by a shopper.
 */
@ObjectType()
export class SellerAccount {
  @Field(() => ID)
  id!: string;

  @Field()
  slug!: string;

  @Field({ description: 'Trading name shown to buyers' })
  name!: string;

  @Field(() => String, { nullable: true })
  logo!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Name as printed on the trade licence',
  })
  legalName!: string | null;

  @Field(() => LegalForm, { nullable: true })
  legalForm!: LegalForm | null;

  @Field(() => Emirate, { nullable: true })
  emirate!: Emirate | null;

  @Field(() => String, { nullable: true })
  addressLine!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  tradeLicenseNumber!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  tradeLicenseExpiry!: Date | null;

  @Field(() => String, { nullable: true })
  emiratesIdNumber!: string | null;

  @Field(() => String, {
    nullable: true,
    description: '15-digit VAT number; only required above AED 375,000 turnover',
  })
  trn!: string | null;

  @Field(() => VerificationStatus)
  verificationStatus!: VerificationStatus;

  @Field(() => String, {
    nullable: true,
    description: "Reviewer's reason, set when the status is REJECTED",
  })
  verificationNote!: string | null;

  @Field(() => String, { nullable: true, middleware: [isoDate] })
  submittedAt!: Date | null;

  @Field(() => [SellerDocument])
  documents!: SellerDocument[];

  @Field(() => [SellerDocumentType], {
    description: 'Document types still missing before this can be submitted',
  })
  missingDocuments!: SellerDocumentType[];
}
