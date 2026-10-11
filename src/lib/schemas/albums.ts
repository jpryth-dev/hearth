import { z } from "zod";

/** An album title: trimmed, 1–100 characters. */
export const albumTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the album a title")
  .max(100, "Use 100 characters or fewer");

/** Optional; blank input becomes null so "no description" has one form. */
export const albumDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "Use 1000 characters or fewer")
  .transform((s) => (s === "" ? null : s));

/** Title and description, for creating and editing an album. */
export const albumInputSchema = z.object({
  title: albumTitleSchema,
  description: albumDescriptionSchema,
});

/** Raw form values before parsing. */
export type AlbumInput = z.input<typeof albumInputSchema>;

/** Levels an owner can grant. Ownership itself is never granted. */
export const accessLevelSchema = z.enum(["VIEW", "CONTRIBUTE"]);
