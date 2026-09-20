/* Pushes plan-catalogue.ts into the Plan table.
 *
 * The API only seeds plans when the table is EMPTY, on purpose — prices an
 * admin has edited must never be overwritten by a deploy. That also means
 * renaming a plan in the catalogue never reaches a database that already has
 * rows, which is what this script is for.
 *
 * Names, taglines, ordering and the feature lists are rewritten. Prices are
 * left exactly as they are in the database, for the same reason the boot seed
 * leaves them alone.
 *
 *   npm run plans:sync
 */
import { PrismaClient } from '@prisma/client';
import { PLAN_CATALOGUE } from '../src/billing/plan-catalogue';

const prisma = new PrismaClient();

async function main() {
  for (const seed of PLAN_CATALOGUE) {
    const plan = await prisma.plan.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        tagline: seed.tagline,
        monthlyPrice: seed.monthlyPrice,
        quarterlyPrice: seed.quarterlyPrice,
        sortOrder: seed.sortOrder,
      },
      update: {
        name: seed.name,
        tagline: seed.tagline,
        sortOrder: seed.sortOrder,
      },
    });

    /* Features are positional, so they are replaced wholesale rather than
       merged — a diff would leave orphans behind. */
    await prisma.planFeature.deleteMany({ where: { planId: plan.id } });
    await prisma.planFeature.createMany({
      data: seed.features.map((feature, position) => ({
        planId: plan.id,
        kind: feature.kind,
        title: feature.title ?? null,
        label: feature.label,
        included: feature.included ?? true,
        position,
      })),
    });

    console.log(
      `${seed.code.padEnd(9)} -> "${plan.name}"  (${seed.features.length} features, prices untouched)`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
