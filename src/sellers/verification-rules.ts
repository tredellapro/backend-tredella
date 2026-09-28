import type { SellerDocumentType } from '../common/constants';

/* When a seller's trade registration may be approved.
 *
 * Deliberately pure and dependency-free — no Prisma, no Nest — so it can be
 * compiled and exercised on its own, and so the seller-facing
 * `missingDocuments` and the admin's approval check cannot drift apart. They
 * are the same question asked by two different people.
 *
 * Mirrors admin-tredella/src/lib/verification.ts. If a rule changes here it
 * has to change there too, or the console will offer an Approve button the
 * API then refuses.
 */

export const ALWAYS_REQUIRED: SellerDocumentType[] = [
  'TRADE_LICENSE',
  'EMIRATES_ID_FRONT',
  'EMIRATES_ID_BACK',
];

/**
 * A VAT certificate is required **only when the seller gave a TRN**.
 *
 * UAE VAT registration is mandatory above AED 375,000 of turnover. A seller
 * below that has no certificate to produce, so demanding one from everybody
 * would leave them permanently unapprovable.
 */
export const requiredDocuments = (
  trn: string | null | undefined,
): SellerDocumentType[] =>
  trn && trn.trim().length > 0
    ? [...ALWAYS_REQUIRED, 'VAT_CERTIFICATE']
    : ALWAYS_REQUIRED;

export const missingDocuments = (
  trn: string | null | undefined,
  held: SellerDocumentType[],
): SellerDocumentType[] => {
  const present = new Set(held);
  return requiredDocuments(trn).filter((type) => !present.has(type));
};

/** Both are date-only ISO strings, so a string compare is a date compare. */
export const hasExpired = (expiryIso: string, todayIso: string): boolean =>
  expiryIso < todayIso;

export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export interface ApprovalSubject {
  verificationStatus: string;
  trn: string | null;
  tradeLicenseExpiry: Date | null;
  documents: SellerDocumentType[];
}

/**
 * Why this seller cannot be approved, or null when they can.
 *
 * Ordered by what the reviewer would have to do about it. Missing paperwork is
 * a different job from an expired licence, and naming the expiry while three
 * documents are absent sends them down the wrong path.
 */
export const approvalProblem = (
  subject: ApprovalSubject,
  today: string,
): string | null => {
  if (subject.verificationStatus === 'UNSUBMITTED')
    return 'This seller has not submitted their registration yet.';

  const missing = missingDocuments(subject.trn, subject.documents);
  if (missing.length > 0)
    return `Still missing: ${missing.join(', ')}.`;

  if (!subject.tradeLicenseExpiry)
    return 'No trade licence expiry on file.';

  if (hasExpired(isoDay(subject.tradeLicenseExpiry), today))
    return `The trade licence expired on ${isoDay(subject.tradeLicenseExpiry)}. Ask for a current one before verifying.`;

  return null;
};

/**
 * Decisions a reviewer may make from here.
 *
 * Neither APPROVED nor REJECTED is terminal: a licence lapses, an appeal
 * succeeds. That is unlike a payout, where money has irreversibly moved.
 * UNSUBMITTED is not actionable — there is nothing to look at.
 */
export const nextStatuses = (current: string): ('APPROVED' | 'REJECTED')[] => {
  if (current === 'UNSUBMITTED') return [];
  if (current === 'APPROVED') return ['REJECTED'];
  if (current === 'REJECTED') return ['APPROVED'];
  return ['APPROVED', 'REJECTED'];
};
