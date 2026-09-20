import { Field, InputType } from '@nestjs/graphql';
import { Emirate, LegalForm } from '../../common/enums';

/** The trade-registration details a UAE seller submits for review. */
@InputType()
export class SellerVerificationInput {
  @Field({ description: 'Trading name shown to buyers' })
  storeName!: string;

  @Field({ description: 'Name exactly as printed on the trade licence' })
  legalName!: string;

  @Field(() => LegalForm)
  legalForm!: LegalForm;

  @Field(() => Emirate)
  emirate!: Emirate;

  @Field()
  addressLine!: string;

  @Field({ description: 'UAE number in +9715XXXXXXXX form' })
  phone!: string;

  @Field()
  tradeLicenseNumber!: string;

  @Field({ description: 'ISO date (YYYY-MM-DD) the licence expires' })
  tradeLicenseExpiry!: string;

  @Field({ description: '15 digits, formatted 784-YYYY-NNNNNNN-N' })
  emiratesIdNumber!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'VAT number. Leave empty below the AED 375,000 registration threshold.',
  })
  trn?: string | null;
}
