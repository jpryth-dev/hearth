/**
 * Image processing module: the only place uploaded image bytes are inspected
 * or transformed.
 *
 * Contract:
 * - Enforce the upload size cap before any processing.
 * - Verify the type from the file content with sharp. The filename extension
 *   and the client's MIME header are never trusted.
 * - Strip EXIF and GPS data from every stored file. Extracted metadata goes to
 *   PhotoMetadata, behind the album's access checks.
 * - Object keys are random UUIDs (`Photo.storageKey`), never derived from the
 *   filename, album or user.
 * - Never log raw EXIF.
 *
 * @packageDocumentation
 */
import "server-only";

export {};
