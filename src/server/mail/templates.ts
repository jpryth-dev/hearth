import "server-only";

import type { MailMessage } from "./index";

export function invitationMessage(args: {
  to: string;
  inviterName: string;
  link: string;
  expiresAt: Date;
}): MailMessage {
  return {
    to: args.to,
    subject: "You're invited to Hearth",
    text: [
      `${args.inviterName} has invited you to Hearth, a private family photo space.`,
      "",
      "Accept your invitation:",
      args.link,
      "",
      `This link works once and expires on ${args.expiresAt.toUTCString()}.`,
      "If you weren't expecting this, you can ignore it.",
    ].join("\n"),
  };
}

export function signInMessage(args: { to: string; link: string }): MailMessage {
  return {
    to: args.to,
    subject: "Your Hearth sign-in link",
    text: [
      "Sign in to Hearth:",
      args.link,
      "",
      "This link works once and expires in 15 minutes.",
      "If you didn't ask to sign in, you can ignore this email.",
    ].join("\n"),
  };
}
