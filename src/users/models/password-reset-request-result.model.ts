import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PasswordResetRequestResult {
  @Field({
    description: 'Always true — never reveals whether the email is registered',
  })
  ok!: boolean;

  @Field({
    description:
      'False when SMTP is unconfigured (dev): the link is logged to the server console',
  })
  emailSent!: boolean;
}
