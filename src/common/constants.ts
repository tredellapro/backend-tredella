/* String "enums" — kept as validated strings so the Prisma schema stays
   portable (no native enums) while the GraphQL layer still exposes real enums
   where the buyer app expects them (Mode, SortBy). */

export const ROLES = ['BUYER', 'SELLER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const MODES = ['RETAIL', 'WHOLESALE'] as const;
export type Mode = (typeof MODES)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CONVERSATION_TYPES = [
  'BUYER_SELLER',
  'BUYER_ADMIN',
  'SELLER_ADMIN',
] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'MESSAGE',
  'QUESTION_ANSWERED',
  'ORDER_UPDATE',
  'DELIVERY_UPDATE',
  'REVIEW_ELIGIBLE',
  // seller dashboard
  'PRODUCT_APPROVED',
  'PRODUCT_REJECTED',
  'PROMOTION',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const isMode = (v: string): v is Mode => MODES.includes(v as Mode);

/* ---------------- UAE seller registration ---------------- */

export const EMIRATES = [
  'DUBAI',
  'ABU_DHABI',
  'SHARJAH',
  'AJMAN',
  'UMM_AL_QUWAIN',
  'RAS_AL_KHAIMAH',
  'FUJAIRAH',
] as const;
export type Emirate = (typeof EMIRATES)[number];

export const LEGAL_FORMS = [
  'SOLE_ESTABLISHMENT',
  'LLC',
  'FREE_ZONE',
  'BRANCH',
  'CIVIL_COMPANY',
] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

/** Emirates ID is scanned front and back, so each side is its own record. */
export const SELLER_DOCUMENT_TYPES = [
  'TRADE_LICENSE',
  'EMIRATES_ID_FRONT',
  'EMIRATES_ID_BACK',
  'VAT_CERTIFICATE',
] as const;
export type SellerDocumentType = (typeof SELLER_DOCUMENT_TYPES)[number];

/** A registration cannot be submitted without these on file. */
export const REQUIRED_SELLER_DOCUMENTS: SellerDocumentType[] = [
  'TRADE_LICENSE',
  'EMIRATES_ID_FRONT',
  'EMIRATES_ID_BACK',
];

export const VERIFICATION_STATUSES = [
  'UNSUBMITTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Events published on the PubSub bus. */
export const EVENTS = {
  MESSAGE_ADDED: 'MESSAGE_ADDED',
  NOTIFICATION_ADDED: 'NOTIFICATION_ADDED',
} as const;
