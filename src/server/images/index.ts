/**
 * Image processing module: the only place uploaded image bytes are inspected
 * or transformed.
 *
 * Contract:
 * - Enforce the upload size cap before any processing (`readLimited`).
 * - Verify the type from the file content with sharp. The filename extension
 *   and the client's MIME header are never trusted (`processImage`).
 * - Strip EXIF and GPS data from every stored file. Extracted metadata goes to
 *   PhotoMetadata, behind the album's access checks.
 * - Object keys are random UUIDs (`Photo.storageKey`), never derived from the
 *   filename, album or user. (Keys are chosen by the data layer, not here.)
 * - Never log raw EXIF.
 *
 * @packageDocumentation
 */
import "server-only";

export { FULL_MAX_EDGE, MAX_INPUT_PIXELS, MAX_UPLOAD_BYTES, THUMB_MAX_EDGE } from "./limits";
export type { ExtractedMetadata } from "./metadata";
export { processImage, type ProcessResult, type ProcessedImage, type RejectionReason } from "./process";
export { readLimited, type ReadResult } from "./read-limited";
