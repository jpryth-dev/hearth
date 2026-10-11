import { z } from "zod";

import { AuditAction } from "@/generated/prisma/enums";

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/**
 * Filters for the Security Activity Report, parsed from the query string.
 * Empty form fields mean "no filter". Days are UTC.
 */
export const activityFilterSchema = z.object({
  action: z.preprocess(blankToUndefined, z.enum(AuditAction).optional()),
  actorId: z.preprocess(blankToUndefined, z.uuid().optional()),
  from: z.preprocess(blankToUndefined, isoDay.optional()),
  to: z.preprocess(blankToUndefined, isoDay.optional()),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
});

export type ActivityFilter = z.infer<typeof activityFilterSchema>;
