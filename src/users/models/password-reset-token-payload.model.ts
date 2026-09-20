import { Field, ObjectType } from '@nestjs/graphql';

/** Handed back when a 6-digit reset code is accepted: feed it to `resetPassword`. */
@ObjectType()
export class PasswordResetTokenPayload {
  @Field({ description: 'Single-use token, valid for the rest of the reset window' })
  token!: string;
}
