import { z } from "zod";

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
