/* The two seller tiers. Seeded into the Plan table so the apps read prices
   from the API and admin can change them later without a release — nothing
   here is hardcoded in a frontend.

   There are exactly two, and what separates them is which storefronts a seller
   may operate: Retail is the retail tab only, Wholesale + Retail is both. The
   seller app maps that capability from the plan CODE (see modesForPlan), so
   the codes BASIC and STANDARD stay put — renaming them would strand every
   existing subscription row. The names below are what anyone actually reads.

   Prices are AED, billed MONTHLY.

   Quarterly billing was dropped as a product (2026-09-21) and is offered
   nowhere in the apps. `quarterlyPrice` stays because the Plan column and the
   BillingInterval enum are part of the committed GraphQL contract — removing
   them is a schema change, not a copy change. Until then the figure is dead
   weight: do not resurrect a period picker from its presence. */

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

export const PLAN_CATALOGUE: SeedPlan[] = [
  {
    code: 'BASIC',
    name: 'Retail',
    tagline: 'Sell single units to shoppers across the UAE.',
    monthlyPrice: 150,
    quarterlyPrice: 405,
    sortOrder: 1,
    features: [
      { kind: 'FEATURE', label: 'Retail storefront' },
      { kind: 'FEATURE', label: 'Unlimited product listings' },
      { kind: 'FEATURE', label: '10 product showcases' },
      { kind: 'FEATURE', label: '20 RFQ responses a month' },
      { kind: 'FEATURE', label: 'Business verification support' },
      { kind: 'FEATURE', label: 'Wholesale storefront', included: false },
      {
        kind: 'FEATURE',
        label: 'Full-service onboarding help for 60 days',
        included: false,
      },
      { kind: 'FEATURE', label: 'Dedicated Account Manager', included: false },
      {
        kind: 'NOTE',
        title: 'Retail Tab',
        label:
          'Sell single units to shoppers. A category-based fee applies on retail sales.',
      },
      {
        kind: 'NOTE',
        title: 'Upgrade Anytime',
        label:
          'Move up to Wholesale + Retail whenever you are ready — your listings come with you.',
      },
    ],
  },
  {
    code: 'STANDARD',
    name: 'Wholesale + Retail',
    tagline: 'Everything in Retail, plus the wholesale storefront.',
    monthlyPrice: 200,
    quarterlyPrice: 540,
    sortOrder: 2,
    features: [
      { kind: 'FEATURE', label: 'Retail storefront' },
      { kind: 'FEATURE', label: 'Wholesale storefront' },
      { kind: 'FEATURE', label: 'Unlimited product listings' },
      { kind: 'FEATURE', label: '20 product showcases' },
      { kind: 'FEATURE', label: '40 RFQ responses a month' },
      { kind: 'FEATURE', label: 'Business verification support' },
      { kind: 'FEATURE', label: 'Full-service onboarding help for 60 days' },
      { kind: 'FEATURE', label: 'Dedicated Account Manager' },
      {
        kind: 'NOTE',
        title: 'No Additional Fees',
        label:
          'There aren’t any additional charges or percentages on products that are used for wholesale operations.',
      },
      {
        kind: 'NOTE',
        title: 'Both Storefronts',
        label:
          'Switch between retail and wholesale from your dashboard, and list a product in either or both.',
      },
      {
        kind: 'NOTE',
        title: 'Retail Tab',
        label:
          'Wholesale sellers have access to our retail tab for free; however, a category-based fee will apply.',
      },
    ],
  },
];
