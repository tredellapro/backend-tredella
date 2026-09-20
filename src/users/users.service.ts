import { Injectable } from '@nestjs/common';
import type { Address, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AddressInput } from './dto/address.input';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  addresses(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({ where: { userId } });
  }

  /** Adding a default address demotes whatever was default before. */
  async addAddress(userId: string, input: AddressInput): Promise<Address> {
    if (input.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: {
        ...input,
        country: input.country ?? 'UAE',
        isDefault: input.isDefault ?? false,
        userId,
      },
    });
  }
}
