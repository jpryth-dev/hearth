import { describe, expect, it } from "vitest";

import { uuidSchema } from "./ids";

describe("uuidSchema", () => {
  it("accepts a UUID", () => {
    expect(uuidSchema.safeParse("0b6a7a9e-4f1f-4c1a-9a55-3c1b8d8f2e11").success).toBe(true);
  });

  it.each(["", "not-a-uuid", "../albums/1", "1", "0b6a7a9e-4f1f-4c1a-9a55-3c1b8d8f2e1"])(
    "rejects %j",
    (value) => {
      expect(uuidSchema.safeParse(value).success).toBe(false);
    },
  );
});
