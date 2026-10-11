import "server-only";

import exifReader from "exif-reader";

/** What PhotoMetadata stores. Never logged. */
export interface ExtractedMetadata {
  takenAt: Date | null;
  cameraMake: string | null;
  cameraModel: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  /** Parsed EXIF with binary fields removed, safe to store as JSON. */
  rawExif: JsonObject | null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

const EMPTY: ExtractedMetadata = {
  takenAt: null,
  cameraMake: null,
  cameraModel: null,
  gpsLatitude: null,
  gpsLongitude: null,
  rawExif: null,
};

/** Reads the fields Hearth keeps from an EXIF block. Malformed EXIF yields nothing. */
export function extractMetadata(exifBlock: Buffer | undefined): ExtractedMetadata {
  if (!exifBlock) return EMPTY;
  let exif: ReturnType<typeof exifReader>;
  try {
    exif = exifReader(exifBlock);
  } catch {
    return EMPTY;
  }

  const taken = exif.Photo?.DateTimeOriginal;
  return {
    takenAt: taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : null,
    cameraMake: cleanText(exif.Image?.Make),
    cameraModel: cleanText(exif.Image?.Model),
    gpsLatitude: toDecimal(exif.GPSInfo?.GPSLatitude, exif.GPSInfo?.GPSLatitudeRef, 90),
    gpsLongitude: toDecimal(exif.GPSInfo?.GPSLongitude, exif.GPSInfo?.GPSLongitudeRef, 180),
    rawExif: toJson(exif) as JsonObject,
  };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // EXIF strings are often NUL-padded.
  const text = value.replaceAll("\0", "").trim().slice(0, 100);
  return text === "" ? null : text;
}

/** Degrees/minutes/seconds plus hemisphere to signed decimal, 6 places. */
function toDecimal(dms: number[] | undefined, ref: string | undefined, limit: number): number | null {
  if (!dms || dms.length !== 3 || dms.some((n) => !Number.isFinite(n))) return null;
  const [d = 0, m = 0, s = 0] = dms;
  const sign = ref === "S" || ref === "W" ? -1 : 1;
  const value = sign * (d + m / 60 + s / 3600);
  if (Math.abs(value) > limit) return null;
  return Math.round(value * 1e6) / 1e6;
}

/** Drops binary data (maker notes, thumbnails) and anything not representable as JSON. */
function toJson(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 4) return undefined;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => toJson(v, depth + 1)).filter((v): v is JsonValue => v !== undefined);
  }
  if (typeof value === "object") {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(value)) {
      const json = toJson(v, depth + 1);
      if (json !== undefined) out[k] = json;
    }
    return out;
  }
  return undefined;
}
