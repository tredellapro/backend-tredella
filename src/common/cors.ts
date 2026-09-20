import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/* Allow-list of browser origins. Entries may use a `*` wildcard so Vercel
   preview deployments (buyer-tredella-*.vercel.app) work without redeploying
   the API for every branch. */

const parseOrigins = (): string[] =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const originMatches = (origin: string, pattern: string): boolean => {
  if (!pattern.includes('*')) return origin === pattern;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]*');
  return new RegExp(`^${escaped}$`).test(origin);
};

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // server-to-server calls and same-origin requests send no Origin header
    if (!origin) return callback(null, true);
    const allowed = parseOrigins();
    if (allowed.some((pattern) => originMatches(origin, pattern)))
      return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
};
