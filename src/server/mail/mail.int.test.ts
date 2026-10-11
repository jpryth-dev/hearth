import { beforeEach, describe, expect, it } from "vitest";

import { clearMailbox, firstLink, mailTo } from "../../../tests/mailpit";
import { sendMail } from "./index";
import { invitationMessage } from "./templates";

describe("sendMail", () => {
  beforeEach(clearMailbox);

  it("delivers a plain-text invitation through SMTP", async () => {
    await sendMail(
      invitationMessage({
        to: "new@example.com",
        inviterName: "Ada",
        link: "http://localhost:3000/invite/abc",
        expiresAt: new Date("2026-01-08T00:00:00Z"),
      }),
    );

    const [mail] = await mailTo("new@example.com");
    expect(mail?.subject).toBe("You're invited to Hearth");
    expect(firstLink(mail?.text ?? "")).toBe("http://localhost:3000/invite/abc");
  });
});
