import { describe, expect, it } from "vitest";

import { tokenSchema } from "@/lib/schemas";

import { generateToken, hashToken } from "./tokens";

describe("tokens", () => {
  it("generates tokens that pass the shared token schema", () => {
    expect(tokenSchema.safeParse(generateToken().token).success).toBe(true);
  });

  it("never repeats a token", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken().token));
    expect(tokens.size).toBe(1000);
  });

  it("stores a hash, not the token", () => {
    const { token, hash } = generateToken();
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hash);
  });
});
