import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { BillingInterval, PlanFeatureKind } from '../../common/enums';

@ObjectType({ description: 'One row on a plan card.' })
export class PlanFeature {
  @Field(() => ID)
  id!: string;

  @Field(() => PlanFeatureKind)
  kind!: PlanFeatureKind;

  @Field(() => String, {
    nullable: true,
    description: 'Bold lead-in on a NOTE row',
  })
  title!: string | null;

  @Field()
  label!: string;

  @Field({ description: 'FEATURE rows render a cross when false' })
  included!: boolean;

  @Field(() => Int)
  position!: number;
}

@ObjectType()
export class Plan {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'BASIC | STANDARD' })
  code!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  tagline!: string | null;

  @Field(() => Float)
  monthlyPrice!: number;

  @Field(() => Float, { description: 'Three-month total, already 10% off' })
  quarterlyPrice!: number;

  @Field({ description: 'ISO code — AED' })
  currency!: string;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => [PlanFeature])
  features!: PlanFeature[];

  @Field(() => Float, {
    description: 'Price for the interval asked for, so clients do no arithmetic',
  })
  price!: number;
}

export { BillingInterval };
