/** Largest upload accepted, checked while reading the body. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Largest image accepted, checked from the header before full decoding. */
export const MAX_INPUT_PIXELS = 50_000_000;

/** Longest side of the stored full-size image. */
export const FULL_MAX_EDGE = 4096;

/** Longest side of the stored thumbnail. */
export const THUMB_MAX_EDGE = 640;
