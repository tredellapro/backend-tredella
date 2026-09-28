/* One-time backfill for the product-approval migration.
 *
 * `Product.approvalStatus` defaults to PENDING, which is right for anything a
 * seller creates from now on. But applying that default to a database that
 * already has listings would take every one of them off the storefront at
 * once — they predate the review step and were never rejected by anybody.
 *
 * So: everything that exists at migration time is treated as already
 * approved. Run it directly after `npm run db:push`.
 *
 *   npm run db:approve-existing
 *
 * Safe to re-run: it only touches rows that have never been reviewed AND were
 * created before the cutoff, so a genuinely new PENDING listing is left alone.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cutoffArg = process.argv[2];
  const cutoff = cutoffArg ? new Date(cutoffArg) : new Date();

  if (Number.isNaN(cutoff.getTime()))
    throw new Error(`"${cutoffArg}" is not a date.`);

  const candidates = await prisma.product.findMany({
    where: {
      approvalStatus: 'PENDING',
      reviewedAt: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, name: true },
  });

  if (candidates.length === 0) {
    console.log('Nothing to backfill — no unreviewed listings before the cutoff.');
    return;
  }

  const { count } = await prisma.product.updateMany({
    where: { id: { in: candidates.map((product) => product.id) } },
    data: { approvalStatus: 'APPROVED', reviewedAt: cutoff },
  });

  console.log(
    `Approved ${count} listing(s) that predate the review step (cutoff ${cutoff.toISOString()}).`,
  );
  console.log(
    'Anything a seller creates from now on starts as PENDING and needs an admin.',
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
