import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { activityFilterSchema } from "@/lib/schemas";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { ForbiddenError } from "@/server/errors";

import { resetDatabase } from "../../../tests/db";
import { makeUser } from "../../../tests/factories";
import { PAGE_SIZE, activityCsv, activityReport, activitySummary, csvCell } from "./activity";

const IP = "192.0.2.20";
const filter = (raw: Record<string, string> = {}) => activityFilterSchema.parse(raw);

async function at(when: string, entry: Parameters<typeof recordAudit>[0]) {
  await recordAudit(entry);
  const latest = await db.auditLog.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  await db.auditLog.update({ where: { id: latest.id }, data: { createdAt: new Date(when) } });
}

describe("activity report", () => {
  beforeEach(resetDatabase);
  afterAll(() => db.$disconnect());

  async function ctx() {
    return { actor: await makeUser({ role: "ADMIN" }), ipAddress: IP };
  }

  it("is admin-only, for the report, summary and CSV alike", async () => {
    const member = { actor: await makeUser(), ipAddress: IP };
    await expect(activityReport(member, filter())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(activitySummary(member)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(activityCsv(member, filter())).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count({ where: { action: "ACCESS_DENIED", actorUserId: member.actor.id } })).toBe(3);
  });

  it("lists newest first, names actors and subjects, but not album titles", async () => {
    const admin = await ctx();
    const owner = await makeUser({ email: "owner@example.com" });
    const bob = await makeUser({ email: "bob@example.com" });
    const album = await db.album.create({ data: { ownerId: owner.id, title: "Secret Holiday" } });
    await at("2026-03-01T10:00:00Z", { action: "ALBUM_CREATED", actorUserId: owner.id, targetType: "album", targetId: album.id });
    await at("2026-03-02T10:00:00Z", {
      action: "ACCESS_GRANTED",
      actorUserId: owner.id,
      targetType: "album",
      targetId: album.id,
      details: { userId: bob.id, accessLevel: "VIEW" },
    });

    const { rows } = await activityReport(admin, filter());
    expect(rows.map((r) => r.action)).toEqual(["ACCESS_GRANTED", "ALBUM_CREATED"]);
    expect(rows[0]).toMatchObject({ actor: "Member <owner@example.com>", subject: "Member <bob@example.com>", targetId: album.id });
    expect(JSON.stringify(rows)).not.toContain("Secret Holiday");
  });

  it("filters by action, actor and inclusive UTC day range", async () => {
    const admin = await ctx();
    const a = await makeUser();
    const b = await makeUser();
    await at("2026-05-01T23:59:00Z", { action: "LOGIN_FAILURE", actorUserId: null, details: { reason: "unknown_email" } });
    await at("2026-05-02T00:01:00Z", { action: "LOGIN_SUCCESS", actorUserId: a.id });
    await at("2026-05-03T12:00:00Z", { action: "LOGIN_SUCCESS", actorUserId: b.id });

    const ids = async (raw: Record<string, string>) => (await activityReport(admin, filter(raw))).rows.length;
    expect(await ids({ action: "LOGIN_SUCCESS" })).toBe(2);
    expect(await ids({ actorId: a.id })).toBe(1);
    expect(await ids({ from: "2026-05-02", to: "2026-05-02" })).toBe(1);
    expect(await ids({ to: "2026-05-01" })).toBe(1);
    expect(await ids({ action: "", actorId: "", from: "", to: "" })).toBe(3);
  });

  it("pages 50 at a time", async () => {
    const admin = await ctx();
    await db.auditLog.createMany({
      data: Array.from({ length: PAGE_SIZE + 5 }, () => ({ action: "LOGIN_FAILURE" as const })),
    });
    const first = await activityReport(admin, filter());
    const second = await activityReport(admin, filter({ page: "2" }));
    expect([first.rows.length, first.hasNext, second.rows.length, second.hasNext]).toEqual([PAGE_SIZE, true, 5, false]);
  });

  it("summarises the last 7 and 30 days", async () => {
    const admin = await ctx();
    const now = new Date("2026-06-30T12:00:00Z");
    await at("2026-06-29T00:00:00Z", { action: "ACCESS_DENIED", actorUserId: null });
    await at("2026-06-10T00:00:00Z", { action: "ACCESS_DENIED", actorUserId: null });
    await at("2026-06-28T00:00:00Z", { action: "INVITATION_EXPIRED_USE", actorUserId: null });
    await at("2026-04-01T00:00:00Z", { action: "LOGIN_FAILURE", actorUserId: null });

    const summary = await activitySummary(admin, now);
    expect(summary["Denied access"]).toEqual({ last7: 1, last30: 2 });
    expect(summary["Failed sign-ins"]).toEqual({ last7: 1, last30: 1 });
    expect(summary.Deletions).toEqual({ last7: 0, last30: 0 });
  });

  it("exports CSV with formula injection neutralised", async () => {
    const admin = await ctx();
    const sneaky = await db.user.create({
      data: { email: "x@example.com", displayName: '=HYPERLINK("http://evil","click")' },
    });
    await recordAudit({ action: "LOGIN_SUCCESS", actorUserId: sneaky.id, ipAddress: IP });

    const csv = await activityCsv(admin, filter());
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe("time_utc,action,actor,target_type,target_id,subject,ip_address,details");
    expect(row).toContain(`"'=HYPERLINK(""http://evil"",""click"") <x@example.com>"`);
  });
});

describe("csvCell", () => {
  it.each([
    ["plain", '"plain"'],
    ['say "hi"', '"say ""hi"""'],
    ["=1+1", `"'=1+1"`],
    ["+1", `"'+1"`],
    ["-1", `"'-1"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    [null, '""'],
  ])("%j becomes %s", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
});
