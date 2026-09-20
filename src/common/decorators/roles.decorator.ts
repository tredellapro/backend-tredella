import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { Role } from '../constants';

export const ROLES_KEY = 'roles';

/** Restricts an operation to the given roles. Pair with `RolesGuard`. */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
