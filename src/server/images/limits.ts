/** Largest upload accepted; defined with the shared schemas so the browser can warn early. */
export { MAX_UPLOAD_BYTES } from "@/lib/schemas";

/** Largest image accepted, checked from the header before full decoding. */
export const MAX_INPUT_PIXELS = 50_000_000;

/** Longest side of the stored full-size image. */
export const FULL_MAX_EDGE = 4096;

/** Longest side of the stored thumbnail. */
export const THUMB_MAX_EDGE = 640;
