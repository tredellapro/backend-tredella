import { Field, ID, ObjectType } from '@nestjs/graphql';
import { isoDate } from '../../common/middleware/iso-date.middleware';
import { Address } from './address.model';

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field()
  role!: string;

  @Field(() => String, { nullable: true })
  avatar!: string | null;

  @Field(() => String, { middleware: [isoDate] })
  createdAt!: Date;

  @Field(() => [Address])
  addresses!: Address[];
}
