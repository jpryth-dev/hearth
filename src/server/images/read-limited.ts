import "server-only";

/** The body bytes, or why reading stopped. */
export type ReadResult = { ok: true; bytes: Buffer } | { ok: false; reason: "empty" | "too_large" };

/**
 * Reads a request body into memory, stopping as soon as it passes `maxBytes`.
 * This is the size cap: it runs before any image processing, and a client
 * that lies about Content-Length (or sends none) still can't push past it.
 */
export async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ReadResult> {
  if (!body) return { ok: false, reason: "empty" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }
  if (total === 0) return { ok: false, reason: "empty" };
  return { ok: true, bytes: Buffer.concat(chunks) };
}
