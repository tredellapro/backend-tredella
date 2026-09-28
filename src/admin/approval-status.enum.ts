import { registerEnumType } from '@nestjs/graphql';

/** Mirrors Product.approvalStatus. PENDING is a starting state, not a decision. */
export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

registerEnumType(ApprovalStatus, {
  name: 'ApprovalStatus',
  description: 'Where a listing stands with the admin review.'
});
