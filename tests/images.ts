// Generated test images. Never commit real photos.
import sharp from "sharp";

export interface FakeExif {
  make?: string;
  model?: string;
  takenAt?: string; // "YYYY:MM:DD HH:MM:SS"
  gps?: { lat: string; latRef: "N" | "S"; lon: string; lonRef: "E" | "W" };
}

/** A solid-colour JPEG with optional EXIF, including GPS. */
export async function jpegWithExif(exif: FakeExif = {}, size = { width: 120, height: 80 }): Promise<Buffer> {
  return sharp({ create: { ...size, channels: 3, background: "#3a7" } })
    .jpeg()
    .withExif({
      IFD0: { ...(exif.make && { Make: exif.make }), ...(exif.model && { Model: exif.model }) },
      IFD2: { ...(exif.takenAt && { DateTimeOriginal: exif.takenAt }) },
      IFD3: exif.gps
        ? {
            GPSLatitudeRef: exif.gps.latRef,
            GPSLatitude: exif.gps.lat,
            GPSLongitudeRef: exif.gps.lonRef,
            GPSLongitude: exif.gps.lon,
          }
        : {},
    })
    .toBuffer();
}

export const FAMILY_PHOTO_EXIF: FakeExif = {
  make: "TestCam",
  model: "T-1000",
  takenAt: "2024:07:04 15:30:00",
  gps: { lat: "51/1 30/1 0/1", latRef: "N", lon: "0/1 7/1 30/1", lonRef: "W" },
};

export async function solid(format: "png" | "webp" | "avif" | "gif" | "tiff", size = { width: 50, height: 40 }) {
  return sharp({ create: { ...size, channels: 4, background: "#a37" } })[format]().toBuffer();
}
