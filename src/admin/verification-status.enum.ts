import { registerEnumType } from '@nestjs/graphql';

/** The decisions a reviewer may make. PENDING is a starting state, not a verdict. */
export enum VerificationDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

registerEnumType(VerificationDecision, {
  name: 'VerificationDecision',
  description: 'Approve or reject a seller trade registration.'
});
