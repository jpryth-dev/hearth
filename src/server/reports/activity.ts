import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import type { ActivityFilter } from "@/lib/schemas";
import { assertAdmin } from "@/server/auth/admin-guard";
import type { AdminContext } from "@/server/auth/users";
import { db } from "@/server/db";

export const PAGE_SIZE = 50;
const CSV_ROW_LIMIT = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivityRow {
  id: string;
  at: Date;
  action: AuditAction;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
  /** Name of the user an event concerns (grantee, disabled user), when known. */
  subject: string | null;
  ipAddress: string | null;
  details: string;
}

export interface ActivityPage {
  rows: ActivityRow[];
  page: number;
  hasNext: boolean;
}

export const SUMMARY_CATEGORIES = {
  "Failed sign-ins": ["LOGIN_FAILURE", "INVITATION_EXPIRED_USE"],
  "Denied access": ["ACCESS_DENIED"],
  "Rejected uploads": ["PHOTO_REJECTED"],
  "Invitations sent": ["INVITATION_CREATED"],
  "Invitations accepted": ["INVITATION_ACCEPTED"],
  Deletions: ["ALBUM_DELETED", "PHOTO_DELETED"],
  "Account changes": ["USER_CREATED", "USER_DISABLED", "USER_ENABLED"],
} as const satisfies Record<string, readonly AuditAction[]>;

export type SummaryCategory = keyof typeof SUMMARY_CATEGORIES;
export type ActivitySummary = Record<SummaryCategory, { last7: number; last30: number }>;

function whereFor(filter: ActivityFilter): Prisma.AuditLogWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filter.from) createdAt.gte = new Date(`${filter.from}T00:00:00Z`);
  // "to" is inclusive of the whole day.
  if (filter.to) createdAt.lt = new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + DAY_MS);
  return {
    ...(filter.action && { action: filter.action }),
    ...(filter.actorId && { actorUserId: filter.actorId }),
    ...((filter.from || filter.to) && { createdAt }),
  };
}

function detailsUserId(details: Prisma.JsonValue): string | undefined {
  if (details && typeof details === "object" && !Array.isArray(details) && typeof details.userId === "string") {
    return details.userId;
  }
  return undefined;
}

/** "key: value; key: value" for display and CSV. Details never hold secrets. */
function describeDetails(details: Prisma.JsonValue): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return "";
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("; ");
}

async function toRows(
  logs: Prisma.AuditLogGetPayload<{ include: { actor: { select: { displayName: true; email: true } } } }>[],
): Promise<ActivityRow[]> {
  // Resolve the users an event concerns, so the report reads "Bob" rather
  // than a UUID. Album and photo ids are deliberately left unresolved.
  const userIds = new Set<string>();
  for (const log of logs) {
    const fromDetails = detailsUserId(log.details);
    if (fromDetails) userIds.add(fromDetails);
    if (log.targetType === "user" && log.targetId) userIds.add(log.targetId);
  }
  const users = await db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, displayName: true, email: true },
  });
  const names = new Map(users.map((u) => [u.id, `${u.displayName} <${u.email}>`]));

  return logs.map((log) => {
    const subjectId = detailsUserId(log.details) ?? (log.targetType === "user" ? log.targetId : null);
    return {
      id: log.id,
      at: log.createdAt,
      action: log.action,
      actor: log.actor ? `${log.actor.displayName} <${log.actor.email}>` : null,
      targetType: log.targetType,
      targetId: log.targetId,
      subject: subjectId ? (names.get(subjectId) ?? null) : null,
      ipAddress: log.ipAddress,
      details: describeDetails(log.details),
    };
  });
}

/**
 * One page of the Security Activity Report, newest first.
 *
 * Checks: actor is ADMIN. Album and photo ids are not resolved to titles, so
 * the report never reveals album contents.
 * @throws ForbiddenError for non-admins (audited).
 */
export async function activityReport(ctx: AdminContext, filter: ActivityFilter): Promise<ActivityPage> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "activityReport");
  const logs = await db.auditLog.findMany({
    where: whereFor(filter),
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (filter.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  return {
    rows: await toRows(logs.slice(0, PAGE_SIZE)),
    page: filter.page,
    hasNext: logs.length > PAGE_SIZE,
  };
}

/**
 * Event counts per category over the last 7 and 30 days.
 *
 * @throws ForbiddenError for non-admins (audited).
 */
export async function activitySummary(ctx: AdminContext, now: Date = new Date()): Promise<ActivitySummary> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "activitySummary");
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const [week, month] = await Promise.all(
    [7, 30].map((days) =>
      db.auditLog.groupBy({ by: ["action"], where: { createdAt: { gte: since(days) } }, _count: { _all: true } }),
    ),
  );
  const count = (groups: typeof week, actions: readonly AuditAction[]) =>
    (groups ?? []).filter((g) => actions.includes(g.action)).reduce((n, g) => n + g._count._all, 0);

  const summary = {} as ActivitySummary;
  for (const [category, actions] of Object.entries(SUMMARY_CATEGORIES) as [SummaryCategory, readonly AuditAction[]][]) {
    summary[category] = { last7: count(week, actions), last30: count(month, actions) };
  }
  return summary;
}

/**
 * Spreadsheet cell: quoted, with formula-looking values neutralised so a
 * crafted display name or email can't run as a formula when opened.
 */
export function csvCell(value: string | null): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * The filtered report as CSV (all pages, up to 10,000 rows), oldest last.
 *
 * @throws ForbiddenError for non-admins (audited).
 */
export async function activityCsv(ctx: AdminContext, filter: ActivityFilter): Promise<string> {
  await assertAdmin(ctx.actor, ctx.ipAddress, "activityCsv");
  const logs = await db.auditLog.findMany({
    where: whereFor(filter),
    include: { actor: { select: { displayName: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CSV_ROW_LIMIT,
  });
  const header = ["time_utc", "action", "actor", "target_type", "target_id", "subject", "ip_address", "details"];
  const lines = (await toRows(logs)).map((r) =>
    [r.at.toISOString(), r.action, r.actor, r.targetType, r.targetId, r.subject, r.ipAddress, r.details]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
