import { afterEach, describe, expect, it, vi } from "vitest";

describe("db client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (globalThis as { prisma?: unknown }).prisma;
  });

  it("refuses to start without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(import("./db")).rejects.toThrow("DATABASE_URL is not set");
  });
});
