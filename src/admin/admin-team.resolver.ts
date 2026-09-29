import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { User } from '@prisma/client';
import {
  SectionAccess,
  SectionAccessInput,
  StaffMember,
} from './models/staff-member.model';
import { AdminTeamService } from './admin-team.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GqlAuthGuard } from '../common/guards/gql-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { permissionsFor, type Permissions, type StaffRole } from './staff-access';
import type { JwtPayload } from '../auth/token.service';

const toPairs = (permissions: Permissions): SectionAccess[] =>
  Object.entries(permissions).map(([section, access]) => ({ section, access }));

/* Cast rather than validated here on purpose: the section names and access
   levels are checked by customGrantProblem in the service, which is the one
   place that decides what a usable grant is. Validating in two places means
   two chances to disagree. */
const fromPairs = (
  input?: SectionAccessInput[] | null,
): Permissions | null =>
  input
    ? (Object.fromEntries(
        input.map((entry) => [entry.section, entry.access]),
      ) as Permissions)
    : null;

/**
 * Granting console access.
 *
 * Guarded as ADMIN here, then checked again for SUPER_ADMIN inside the service
 * — the role guard cannot express "super admin only", and putting that check
 * in the service means it holds however the operation is reached.
 */
@Resolver(() => StaffMember)
@UseGuards(GqlAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTeamResolver {
  constructor(private readonly team: AdminTeamService) {}

  private present(user: User): StaffMember {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      staffRole: user.staffRole ?? 'NONE',
      permissions: toPairs(
        permissionsFor(
          (user.staffRole as StaffRole | null) ?? null,
          (user.staffPermissions as Permissions | null) ?? null,
        ),
      ),
    };
  }

  @Query(() => [StaffMember], {
    description: 'Everyone with console access, super admins first.',
  })
  async adminTeam(
    @CurrentUser() user: JwtPayload,
  ): Promise<StaffMember[]> {
    const rows = await this.team.list(user.userId);
    return rows.map((row) => this.present(row));
  }

  @Query(() => [SectionAccess], {
    description:
      "The signed-in member's own access, so the console can shape itself to it.",
  })
  async myAdminAccess(
    @CurrentUser() user: JwtPayload,
  ): Promise<SectionAccess[]> {
    return toPairs(await this.team.permissionsOf(user.userId));
  }

  @Mutation(() => StaffMember, {
    description:
      'Give an existing account console access, by email. Super admin only.',
  })
  async grantAdminAccess(
    @CurrentUser() user: JwtPayload,
    @Args('email') email: string,
    @Args('staffRole', { type: () => String }) staffRole: string,
    @Args('permissions', { type: () => [SectionAccessInput], nullable: true })
    permissions?: SectionAccessInput[] | null,
  ): Promise<StaffMember> {
    return this.present(
      await this.team.grant(
        user.userId,
        email,
        staffRole,
        fromPairs(permissions),
      ),
    );
  }

  @Mutation(() => StaffMember, {
    description:
      'Take console access away. The account itself is left alone. Super admin only.',
  })
  async revokeAdminAccess(
    @CurrentUser() user: JwtPayload,
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<StaffMember> {
    return this.present(await this.team.revoke(user.userId, userId));
  }
}
