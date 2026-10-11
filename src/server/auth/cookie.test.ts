import { describe, expect, it } from "vitest";

import { sessionCookieConfig } from "./cookie";

describe("sessionCookieConfig", () => {
  it("uses a Secure __Host- cookie over https", () => {
    expect(sessionCookieConfig("https://hearth.example")).toEqual({
      name: "__Host-hearth_session",
      secure: true,
    });
  });

  it("drops Secure and the prefix over plain http", () => {
    expect(sessionCookieConfig("http://localhost:3000")).toEqual({
      name: "hearth_session",
      secure: false,
    });
  });
});
