/* The two seller tiers, as drawn in Figma. Seeded into the Plan table so the
   apps read prices from the API and admin can change them later without a
   release — nothing here is hardcoded in a frontend.

   Prices are AED. The quarterly figure is the three-month total less 10%:
   150×3 = 450 → 405, and 200×3 = 600 → 540. */

export type SeedFeature = {
  kind: 'FEATURE' | 'NOTE';
  title?: string;
  label: string;
  included?: boolean;
};

export type SeedPlan = {
  code: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  sortOrder: number;
  features: SeedFeature[];
};

/** Shown on every card, below the tick list. */
const SHARED_NOTES: SeedFeature[] = [
  {
    kind: 'NOTE',
    title: 'No Additional Fees',
    label:
      'There aren’t any additional charges or percentages on products that are used for wholesale operations.'
  },
  {
    kind: 'NOTE',
    title: 'Retail Option',
    label:
      'The subscription is able to be used for retail and wholesale operations, which allows for flexibility when selling products.'
  },
  {
    kind: 'NOTE',
    title: 'Retail Tab',
    label:
      'Wholesale sellers have access to our retail tab for free; however, a category-based fee will apply.'
  }
];

export const PLAN_CATALOGUE: SeedPlan[] = [
  {
    code: 'BASIC',
    name: 'Basic Plan',
    tagline: 'Everything in our basic plan plus…',
    monthlyPrice: 150,
    quarterlyPrice: 405,
    sortOrder: 1,
    features: [
      { kind: 'FEATURE', label: 'Unlimited product listings' },
      { kind: 'FEATURE', label: '10 product showcases' },
      { kind: 'FEATURE', label: '20 RFQ responses a month' },
      { kind: 'FEATURE', label: 'Business verification support' },
      {
        kind: 'FEATURE',
        label: 'Full-service onboarding help for 60 days',
        included: false
      },
      { kind: 'FEATURE', label: 'Dedicated Account Manager', included: false },
      ...SHARED_NOTES
    ]
  },
  {
    code: 'STANDARD',
    name: 'Standard Plan',
    tagline: 'Everything in our standard plan plus…',
    monthlyPrice: 200,
    quarterlyPrice: 540,
    sortOrder: 2,
    features: [
      { kind: 'FEATURE', label: 'Unlimited product listings' },
      { kind: 'FEATURE', label: '20 product showcases' },
      { kind: 'FEATURE', label: '40 RFQ responses a month' },
      { kind: 'FEATURE', label: 'Business verification support' },
      { kind: 'FEATURE', label: 'Full-service onboarding help for 60 days' },
      { kind: 'FEATURE', label: 'Dedicated Account Manager' },
      ...SHARED_NOTES
    ]
  }
];
