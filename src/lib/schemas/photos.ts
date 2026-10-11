import { z } from "zod";

/** Largest upload accepted. Checked in the browser for a quick message and enforced on the server while reading the body. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** What the file picker offers. The server decides by content, not by this list. */
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * The uploaded file's name, kept for display only (never used in storage
 * keys). Any path is dropped, control characters removed, and the result
 * capped; an empty name becomes null.
 */
export const photoFilenameSchema = z
  .string()
  .transform((name) => name.split(/[\\/]/).pop() ?? "")
  .transform((name) => name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200))
  .transform((name) => (name === "" ? null : name));
