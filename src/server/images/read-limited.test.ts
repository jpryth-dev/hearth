import { describe, expect, it } from "vitest";

import { readLimited } from "./read-limited";

function streamOf(...chunks: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
}

describe("readLimited", () => {
  it("reads a body within the limit", async () => {
    const result = await readLimited(streamOf(10, 20), 30);
    expect(result.ok && result.bytes.length).toBe(30);
  });

  it("stops as soon as the limit is passed", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    expect(await readLimited(endless, 4096)).toEqual({ ok: false, reason: "too_large" });
    expect(pulled).toBeLessThan(10);
  });

  it("rejects an empty or missing body", async () => {
    expect(await readLimited(null, 10)).toEqual({ ok: false, reason: "empty" });
    expect(await readLimited(streamOf(), 10)).toEqual({ ok: false, reason: "empty" });
  });
});
