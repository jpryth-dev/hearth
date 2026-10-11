import { prettifyError, ZodError } from "zod";

import { serverEnvSchema, storageEnvSchema } from "@/lib/schemas";

/**
 * Runs once when the server starts. Fails the boot if configuration is
 * missing or malformed, so a bad deploy is caught immediately rather than on
 * the first sign-in or upload.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    serverEnvSchema.parse(process.env);
    storageEnvSchema.parse(process.env);
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  } catch (error) {
    const detail = error instanceof ZodError ? prettifyError(error) : String(error);
    throw new Error(`Hearth configuration is invalid (see .env.example):\n${detail}`);
  }
}
