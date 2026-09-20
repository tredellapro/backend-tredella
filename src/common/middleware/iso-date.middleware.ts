import type { FieldMiddleware, NextFn } from '@nestjs/graphql';

/* Dates cross the wire as ISO strings (the schema types them `String`), so
   every Date-backed field passes through this instead of repeating a
   `@ResolveField` per timestamp. */
export const isoDate: FieldMiddleware = async (
  _ctx: unknown,
  next: NextFn,
): Promise<unknown> => {
  const value: unknown = await next();
  return value instanceof Date ? value.toISOString() : value;
};
