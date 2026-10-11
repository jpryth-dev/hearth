import "server-only";

import { serverEnvSchema, type ServerEnv } from "@/lib/schemas";

let cached: ServerEnv | undefined;

/**
 * Validated server configuration. Parsed lazily so `next build` does not need
 * mail settings, but the first request that does fails loudly if they're wrong.
 *
 * @throws ZodError if a variable is missing or malformed.
 */
export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
