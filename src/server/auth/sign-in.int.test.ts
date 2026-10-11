import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";

import { resetDatabase } from "../../../tests/db";
import { makeUser } from "../../../tests/factories";
import { clearMailbox, firstLink, mailTo } from "../../../tests/mailpit";
import {
  MAX_LIVE_SIGN_IN_TOKENS,
  SIGN_IN_TOKEN_TTL_MS,
  consumeSignInToken,
  isUsableSignInToken,
  requestSignInLink,
} from "./sign-in";

const IP = "203.0.113.9";

async function linkTokens(email: string): Promise<string[]> {
  return (await mailTo(email)).map((m) => firstLink(m.text).split("/login/verify/")[1] ?? "");
}

async function failureReasons(): Promise<unknown[]> {
  const rows = await db.auditLog.findMany({ where: { action: "LOGIN_FAILURE" }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => (r.details as { reason?: string } | null)?.reason);
}

describe("sign-in links", () => {
  beforeEach(async () => {
    await resetDatabase();
    await clearMailbox();
  });
  afterAll(() => db.$disconnect());

  it("emails an active user a link that signs them in once", async () => {
    const user = await makeUser({ email: "member@example.com" });
    await requestSignInLink(" Member@Example.com", IP);

    const [token] = await linkTokens("member@example.com");
    expect(await isUsableSignInToken(token ?? "")).toBe(true);
    expect(await consumeSignInToken(token ?? "", IP)).toEqual({ ok: true, userId: user.id });
    expect(await consumeSignInToken(token ?? "", IP)).toEqual({ ok: false });
    expect(await failureReasons()).toEqual(["used_link"]);
  });

  it("sends nothing for an unknown address, and audits it", async () => {
    await requestSignInLink("stranger@example.com", IP);

    expect(await mailTo("stranger@example.com")).toEqual([]);
    expect(await db.loginToken.count()).toBe(0);
    expect(await failureReasons()).toEqual(["unknown_email"]);
  });

  it("sends nothing to a disabled user", async () => {
    await makeUser({ email: "off@example.com", status: "DISABLED" });
    await requestSignInLink("off@example.com", IP);

    expect(await mailTo("off@example.com")).toEqual([]);
    expect(await failureReasons()).toEqual(["disabled"]);
  });

  it("rejects a link if the user was disabled after it was sent", async () => {
    const user = await makeUser({ email: "later@example.com" });
    await requestSignInLink("later@example.com", IP);
    await db.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });

    const [token] = await linkTokens("later@example.com");
    expect(await isUsableSignInToken(token ?? "")).toBe(false);
    expect(await consumeSignInToken(token ?? "", IP)).toEqual({ ok: false });
    expect(await failureReasons()).toEqual(["disabled"]);
  });

  it("rejects an expired link", async () => {
    await makeUser({ email: "slow@example.com" });
    await requestSignInLink("slow@example.com", IP, new Date(Date.now() - SIGN_IN_TOKEN_TTL_MS - 1000));

    const [token] = await linkTokens("slow@example.com");
    expect(await isUsableSignInToken(token ?? "")).toBe(false);
    expect(await consumeSignInToken(token ?? "", IP)).toEqual({ ok: false });
    expect(await failureReasons()).toEqual(["expired_link"]);
  });

  it(`caps a user at ${MAX_LIVE_SIGN_IN_TOKENS} live links`, async () => {
    await makeUser({ email: "busy@example.com" });
    for (let i = 0; i < MAX_LIVE_SIGN_IN_TOKENS + 2; i++) {
      await requestSignInLink("busy@example.com", IP);
    }

    expect(await mailTo("busy@example.com")).toHaveLength(MAX_LIVE_SIGN_IN_TOKENS);
    expect(await failureReasons()).toEqual(["rate_limited", "rate_limited"]);
  });

  it("spends the user's other links when one is used", async () => {
    await makeUser({ email: "two@example.com" });
    await requestSignInLink("two@example.com", IP);
    await requestSignInLink("two@example.com", IP);
    const [newer, older] = await linkTokens("two@example.com");

    expect((await consumeSignInToken(newer ?? "", IP)).ok).toBe(true);
    expect(await consumeSignInToken(older ?? "", IP)).toEqual({ ok: false });
  });

  it("lets exactly one of two simultaneous uses win", async () => {
    await makeUser({ email: "race@example.com" });
    await requestSignInLink("race@example.com", IP);
    const [token] = await linkTokens("race@example.com");

    const results = await Promise.all([consumeSignInToken(token ?? "", IP), consumeSignInToken(token ?? "", IP)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it.each(["", "garbage", "A".repeat(43)])("rejects token %j", async (token) => {
    expect(await isUsableSignInToken(token)).toBe(false);
    expect(await consumeSignInToken(token, IP)).toEqual({ ok: false });
  });

  it("stores only token hashes and never audits a raw token", async () => {
    await makeUser({ email: "hash@example.com" });
    await requestSignInLink("hash@example.com", IP);
    const [token] = await linkTokens("hash@example.com");
    await consumeSignInToken(token ?? "", IP);
    await consumeSignInToken(token ?? "", IP);

    const stored = JSON.stringify([await db.loginToken.findMany(), await db.auditLog.findMany()]);
    expect(stored).not.toContain(token);
  });
});
