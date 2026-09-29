/* Refuses to wipe a database that is not obviously a local one.
 *
 * `db:seed` runs deleteMany on nineteen tables before it writes anything. That
 * is fine against a throwaway local Postgres and catastrophic against the
 * hosted database the deployed site is using — and now that DATABASE_URL can
 * point at either, the difference is one line in a .env file nobody re-reads
 * before typing a familiar command.
 *
 * Import this at the top of any script that destroys data.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

export const describeTarget = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/${parsed.pathname.slice(1).split('?')[0]}`;
  } catch {
    return 'an unparseable DATABASE_URL';
  }
};

export const isLocal = (url: string): boolean => {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Call before the first delete. Exits unless the target is local, or the
 * caller passed --i-know-this-wipes-production.
 */
export const guardDestructive = (what: string): void => {
  const url = process.env.DATABASE_URL ?? '';
  const forced = process.argv.includes('--i-know-this-wipes-production');

  if (isLocal(url) || forced) {
    if (forced && !isLocal(url))
      console.warn(
        `\n!!  ${what} is about to WIPE ${describeTarget(url)} — a remote database.\n` +
          '!!  Proceeding because --i-know-this-wipes-production was passed.\n',
      );
    return;
  }

  console.error(
    [
      '',
      `Refusing to run ${what}.`,
      '',
      `  DATABASE_URL points at ${describeTarget(url)}, which is not a local database.`,
      '  This script deletes every row in nineteen tables before it writes anything.',
      '',
      '  If you genuinely mean to wipe it, re-run with:',
      `    npm run db:seed -- --i-know-this-wipes-production`,
      '',
      '  To create an admin without wiping anything, use:',
      '    npm run admin:create -- you@example.com <password>',
      '',
    ].join('\n'),
  );
  process.exit(1);
};
