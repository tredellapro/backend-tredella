import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Creates the root super admin from the environment on boot.
 *
 * Without this there is no way to get into the console on a fresh deployment:
 * `npm run admin:create` needs a shell, and a serverless host does not give you
 * one. So the first account comes from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD,
 * and every other admin is granted access by that account from inside the
 * console.
 *
 * Idempotent — it runs on every boot and every deploy. Set nothing and it does
 * nothing, so local development is unaffected.
 */
@Injectable()
export class SuperAdminBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('SUPER_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    const name = this.config.get<string>('SUPER_ADMIN_NAME')?.trim() || 'Super Admin';
    const id = this.config.get<string>('SUPER_ADMIN_ID')?.trim() || undefined;

    if (!email || !password) return;

    if (!email.includes('@')) {
      this.logger.warn(
        `SUPER_ADMIN_EMAIL "${email}" is not an email address — skipping bootstrap.`,
      );
      return;
    }

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (!existing) {
        await this.prisma.user.create({
          data: {
            ...(id ? { id } : {}),
            email,
            name,
            password: await bcrypt.hash(password, 10),
            role: 'ADMIN',
            staffRole: 'SUPER_ADMIN',
          },
        });
        this.logger.log(`Super admin created from the environment: ${email}`);
        return;
      }

      /* The password is NOT re-applied to an account that already exists.
         Otherwise every deploy would silently undo a password changed from
         inside the console, and a stale value left in the environment would
         quietly become the live one. To rotate it, change it in the console or
         run `npm run admin:create`.

         The role and staff role ARE re-applied: if somebody demoted the root
         account, the environment is the authority on who owns the console. */
      if (existing.role !== 'ADMIN' || existing.staffRole !== 'SUPER_ADMIN') {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN', staffRole: 'SUPER_ADMIN' },
        });
        this.logger.log(`Restored super admin access for ${email}.`);
      }
    } catch (error) {
      /* A failed bootstrap must not stop the API booting — the rest of the
         marketplace does not depend on it. */
      this.logger.error(
        `Could not bootstrap the super admin: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
