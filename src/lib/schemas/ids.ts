import { z } from "zod";

/**
 * A database row id (UUID). Parse every id that arrives from a route param,
 * query string or form before it reaches the data-access layer, so malformed
 * input fails as a validation error instead of a database error.
 */
export const uuidSchema = z.uuid();

export type Uuid = z.infer<typeof uuidSchema>;
