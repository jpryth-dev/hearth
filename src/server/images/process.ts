import "server-only";

import sharp, { type Metadata } from "sharp";

import { FULL_MAX_EDGE, MAX_INPUT_PIXELS, THUMB_MAX_EDGE } from "./limits";
import { extractMetadata, type ExtractedMetadata } from "./metadata";

/** Formats accepted, as detected by sharp from the bytes themselves. */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

function isAccepted(info: Metadata): boolean {
  if (info.format && ACCEPTED_FORMATS.has(info.format)) return true;
  // sharp reports AVIF as HEIF with AV1 compression. HEIC (HEVC) is also
  // "heif" but sharp's prebuilt binaries can't decode it, so only AV1 passes.
  return info.format === "heif" && info.compression === "av1";
}

export type RejectionReason = "unsupported_type" | "too_many_pixels" | "corrupt";

export interface ProcessedImage {
  mimeType: "image/webp";
  full: { data: Buffer; width: number; height: number };
  thumb: { data: Buffer };
  metadata: ExtractedMetadata;
}

export type ProcessResult = { ok: true; image: ProcessedImage } | { ok: false; reason: RejectionReason };

/**
 * Verifies an upload and produces the files Hearth stores.
 *
 * Checks: sharp identifies the bytes as JPEG, PNG, WebP or AVIF (never trust
 * the name or Content-Type; SVG is refused even though sharp can read it);
 * the header's dimensions are within MAX_INPUT_PIXELS; the image decodes.
 *
 * Output: a full-size and a thumbnail WebP, auto-rotated from the EXIF
 * orientation. sharp writes no metadata unless asked, so neither file carries
 * EXIF, XMP or GPS. The EXIF is parsed into `metadata` for PhotoMetadata.
 *
 * Never throws for bad input; returns a reason instead.
 */
export async function processImage(bytes: Buffer): Promise<ProcessResult> {
  let info: Metadata;
  try {
    info = await sharp(bytes, { limitInputPixels: false }).metadata();
  } catch {
    return { ok: false, reason: "unsupported_type" };
  }
  if (!isAccepted(info)) return { ok: false, reason: "unsupported_type" };
  if (!info.width || !info.height) return { ok: false, reason: "corrupt" };
  if (info.width * info.height > MAX_INPUT_PIXELS) return { ok: false, reason: "too_many_pixels" };

  try {
    const full = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(full.data)
      .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    return {
      ok: true,
      image: {
        mimeType: "image/webp",
        full: { data: full.data, width: full.info.width, height: full.info.height },
        thumb: { data: thumb },
        metadata: extractMetadata(info.exif),
      },
    };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}
