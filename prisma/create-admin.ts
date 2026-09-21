/* Creates (or resets the password of) an admin account for admin-tredella.
 *
 * Like demo-seller.ts and unlike seed.ts this is additive — it clears nothing,
 * so it is safe to run against a database that already has real data.
 *
 *   npm run admin:create                                  → the default below
 *   npm run admin:create -- alice@tredella.com s3cret "Alice Khan"
 *   npm run admin:create -- alice@tredella.com s3cret --force
 *
 * Re-running for an email that already exists resets that account's password,
 * which is how a locked-out admin gets back in — there is no self-service
 * reset on the console by design.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_EMAIL = 'admin2@gmail.com';
const DEFAULT_PASSWORD = 'admin123';

/** Must match MIN_PASSWORD_LENGTH in src/auth/auth.service.ts. */
const MIN_PASSWORD_LENGTH = 6;

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const positional = args.filter((arg) => !arg.startsWith('--'));

  const email = (positional[0] ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = positional[1] ?? DEFAULT_PASSWORD;
  const name = positional[2] ?? 'Tredella Admin';

  if (!email.includes('@')) throw new Error(`"${email}" is not an email address.`);

  /* Fail here rather than creating an account the API would then refuse to
     sign in — a login that says "invalid password" for a password you just
     set is a horrible thing to debug. */
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters; "${password}" is ${password.length}.`,
    );

  const existing = await prisma.user.findUnique({ where: { email } });

  /* Promoting a live buyer or seller to ADMIN by mistyping their email would
     hand a customer the whole console, so that needs to be deliberate. */
  if (existing && existing.role !== 'ADMIN' && !force)
    throw new Error(
      `${email} already exists as a ${existing.role}. Promoting a real account to ADMIN ` +
        `gives it the whole console — re-run with --force if that is what you want.`,
    );

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hashed, name, role: 'ADMIN' },
    update: { password: hashed, role: 'ADMIN' },
  });

  console.log(
    existing
      ? `Password reset for ${user.email} (${user.name}) — role ADMIN.`
      : `Admin created: ${user.email} / ${password} (${user.name}).`,
  );
  console.log('Sign in at the admin console — nothing else grants access.');

  if (password.length < 12)
    console.warn(
      `\nHeads up: "${password}" is short for an account that can see every ` +
        `order, payout and customer on the marketplace. Fine for local work; ` +
        `use something longer before this database is real.`,
    );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
