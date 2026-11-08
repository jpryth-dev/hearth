import "server-only";

import type { MailMessage } from "./index";

/** The invitation email. Plain text, so a display name can't inject markup. */
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

/** The sign-in link email. `validMinutes` comes from the TTL that enforces it, so the text can't drift. */
export function signInMessage(args: { to: string; link: string; validMinutes: number }): MailMessage {
  return {
    to: args.to,
    subject: "Your Hearth sign-in link",
    text: [
      "Sign in to Hearth:",
      args.link,
      "",
      `This link works once and expires in ${args.validMinutes} minutes.`,
      "If you didn't ask to sign in, you can ignore this email.",
    ].join("\n"),
  };
}
