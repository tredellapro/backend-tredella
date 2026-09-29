import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

/** One section and what this member may do in it. */
@ObjectType()
export class SectionAccess {
  @Field()
  section!: string;

  @Field(() => String, { description: 'NONE | VIEW | MANAGE' })
  access!: string;
}

@InputType()
export class SectionAccessInput {
  @Field()
  section!: string;

  @Field(() => String, { description: 'NONE | VIEW | MANAGE' })
  access!: string;
}

/**
 * Someone with console access. Deliberately not the public User type — this
 * carries the staff role, which nothing outside the console should see.
 */
@ObjectType()
export class StaffMember {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => String, {
    description: 'SUPER_ADMIN | ADMIN | EDITOR | VIEWER | CUSTOM'
  })
  staffRole!: string;

  /* The resolved map, not the stored overrides: a preset is expanded here so
     the console does not have to keep its own copy of what ADMIN means. */
  @Field(() => [SectionAccess], {
    description: 'Every section and the access this member has to it'
  })
  permissions!: SectionAccess[];
}
