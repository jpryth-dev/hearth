// Reads mail caught by Mailpit (docker-compose.yml, CI service) so tests can
// follow emailed links the way a person would.
import { z } from "zod";

const base = process.env.MAILPIT_URL ?? "http://localhost:8025";

const searchSchema = z.object({ messages: z.array(z.object({ ID: z.string() })) });
const messageSchema = z.object({ Subject: z.string(), Text: z.string() });

export interface CaughtMail {
  subject: string;
  text: string;
}

export async function clearMailbox(): Promise<void> {
  const res = await fetch(`${base}/api/v1/messages`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Mailpit clear failed: ${res.status}`);
}

/** Messages sent to an address, newest first. */
export async function mailTo(email: string): Promise<CaughtMail[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const res = await fetch(`${base}/api/v1/search?query=${query}`);
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`);
  const { messages } = searchSchema.parse(await res.json());
  return Promise.all(
    messages.map(async ({ ID }) => {
      const msg = messageSchema.parse(await (await fetch(`${base}/api/v1/message/${ID}`)).json());
      return { subject: msg.Subject, text: msg.Text };
    }),
  );
}

/** The first http(s) URL in a message body. */
export function firstLink(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("No link in message");
  return match[0];
}
