import { NextResponse, type NextRequest } from "next/server";

import { MAX_UPLOAD_BYTES } from "@/lib/schemas";
import { getCurrentUser } from "@/server/auth";
import { requireAlbumRole, uploadPhoto, type Actor } from "@/server/data";
import { serverEnv } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { readLimited } from "@/server/images";
import { requestIp } from "@/server/request";

const REJECTION_MESSAGES = {
  unsupported_type: "That file isn't a JPEG, PNG, WebP or AVIF image.",
  too_many_pixels: "That image is too large (over 50 megapixels).",
  corrupt: "That image couldn't be read. It may be damaged.",
} as const;

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Upload one photo: the raw file is the request body, its name is in the
 * X-Filename header (URI-encoded, display only).
 *
 * Order matters: origin, session and album role are all checked before a
 * single body byte is read, and the size cap applies while reading.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/albums/[id]/photos">) {
  // Route handlers get no built-in CSRF check, unlike Server Actions.
  if (request.headers.get("origin") !== new URL(serverEnv().APP_URL).origin) {
    return error(403, "Cross-origin upload refused.");
  }
  const user = await getCurrentUser();
  if (!user) return error(401, "Sign in to upload.");
  const actor: Actor = { ...user, ipAddress: await requestIp() };
  const { id } = await ctx.params;

  try {
    await requireAlbumRole(actor, id, "CONTRIBUTE", "uploadPhoto");

    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
      return error(413, "That file is over 25 MB.");
    }
    const body = await readLimited(request.body, MAX_UPLOAD_BYTES);
    if (!body.ok) {
      return body.reason === "too_large" ? error(413, "That file is over 25 MB.") : error(400, "The upload was empty.");
    }

    let filename = "";
    try {
      filename = decodeURIComponent(request.headers.get("x-filename") ?? "");
    } catch {
      // A malformed name only loses the display name.
    }

    const result = await uploadPhoto(actor, id, { bytes: body.bytes, filename });
    if (!result.ok) return error(422, REJECTION_MESSAGES[result.reason]);
    return NextResponse.json({ id: result.photoId }, { status: 201 });
  } catch (e) {
    if (e instanceof NotFoundError) return error(404, "Album not found.");
    throw e;
  }
}
