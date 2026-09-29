import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { badInput, forbidden } from '../common/errors';
import {
  customGrantProblem,
  grantProblem,
  isValidRole,
  permissionsFor,
  revokeProblem,
  type Permissions,
  type StaffMember,
  type StaffRole,
} from './staff-access';

/**
 * Granting console access.
 *
 * The super admin comes from the environment; everyone else is granted by
 * them, by email. That is the shape the client asked for: one root account,
 * and access handed to whichever address they choose.
 */
@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private toMember(user: User): StaffMember {
    return {
      id: user.id,
      email: user.email,
      staffRole: (user.staffRole as StaffRole | null) ?? null,
    };
  }

  private async actor(userId: string): Promise<StaffMember> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw forbidden('Your account no longer exists.');
    return this.toMember(user);
  }

  private countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { staffRole: 'SUPER_ADMIN' } });
  }

  /**
   * Everyone with console access, super admins first.
   *
   * Super admin only. `team` is NONE on every other preset, and the staff list
   * is exactly the map of who to target — an editor has no business reading
   * who else has access and at what level.
   */
  async list(actorId: string): Promise<User[]> {
    const me = await this.actor(actorId);
    if (me.staffRole !== 'SUPER_ADMIN')
      throw forbidden('Only a super admin can see the console team.');

    const rows = await this.prisma.user.findMany({
      where: { staffRole: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    const rank = (user: User) => (user.staffRole === 'SUPER_ADMIN' ? 0 : 1);
    return rows.sort((a, b) => rank(a) - rank(b));
  }

  /** The signed-in member's own permissions, for the console to shape itself. */
  async permissionsOf(userId: string): Promise<Permissions> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return permissionsFor(
      (user?.staffRole as StaffRole | null) ?? null,
      (user?.staffPermissions as Permissions | null) ?? null,
    );
  }

  /**
   * Give (or change) console access for an email address.
   *
   * The account has to exist already — creating a login here would mean
   * inventing a password and emailing it, which is a worse door than asking
   * the person to register first.
   */
  async grant(
    actorId: string,
    email: string,
    role: string,
    permissions?: Permissions | null,
  ): Promise<User> {
    const me = await this.actor(actorId);
    const address = email.trim().toLowerCase();

    if (!isValidRole(role)) throw badInput(`"${role}" is not a role.`);

    const target = await this.prisma.user.findUnique({
      where: { email: address },
    });
    if (!target)
      throw badInput(
        `No account with the email ${address}. They need to register first, then you can give them access.`,
      );

    const problem = grantProblem(
      me,
      this.toMember(target),
      role,
      await this.countSuperAdmins(),
    );
    if (problem) throw forbidden(problem);

    if (role === 'CUSTOM') {
      const bad = customGrantProblem(permissions);
      if (bad) throw badInput(bad);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        staffRole: role,
        staffPermissions: role === 'CUSTOM' ? (permissions ?? {}) : undefined,
        /* Signing into the console is gated on role === ADMIN, so a grant has
           to carry that with it or the person is handed access they cannot
           reach. A seller keeps their store either way — Seller.userId is
           untouched. */
        role: 'ADMIN',
      },
    });

    await this.notifications.notify(target.id, {
      type: 'SYSTEM',
      title: 'You have been given admin access',
      body: `You can now sign in to the Tredella console as ${role.toLowerCase().replace('_', ' ')}.`,
    });

    return updated;
  }

  /** Take console access away. The user account itself is left alone. */
  async revoke(actorId: string, userId: string): Promise<User> {
    const me = await this.actor(actorId);
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw badInput('That account no longer exists.');

    const problem = revokeProblem(
      me,
      this.toMember(target),
      await this.countSuperAdmins(),
    );
    if (problem) throw forbidden(problem);

    /* `role` goes back to BUYER unless they run a store — a seller who helped
       moderate for a month must not lose their dashboard when that ends. */
    const seller = await this.prisma.seller.findUnique({
      where: { userId: target.id },
      select: { id: true },
    });

    return this.prisma.user.update({
      where: { id: target.id },
      data: {
        staffRole: null,
        staffPermissions: undefined,
        role: seller ? 'SELLER' : 'BUYER',
      },
    });
  }
}
