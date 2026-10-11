import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { serverEnv } from "@/server/env";

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text only: no HTML means user-supplied names can't inject markup. */
  text: string;
}

let transport: Transporter | undefined;

/**
 * Sends one email through the configured SMTP server.
 *
 * @throws if the SMTP server rejects the message or can't be reached.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const env = serverEnv();
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  await transport.sendMail({ from: env.MAIL_FROM, ...message });
}
