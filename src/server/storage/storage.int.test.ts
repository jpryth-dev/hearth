import { describe, expect, it } from "vitest";

import { deleteObjects, putObject, signedGetUrl } from "./index";

describe("storage", () => {
  it("serves an object only through a valid signed URL", async () => {
    const key = `${crypto.randomUUID()}/full`;
    await putObject(key, Buffer.from("pixels"), "image/webp");

    const url = await signedGetUrl(key);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(await res.text()).toBe("pixels");

    const unsigned = new URL(url);
    unsigned.search = "";
    expect((await fetch(unsigned)).status).toBe(403);

    const tampered = url.replace(/X-Amz-Signature=[0-9a-f]+/, `X-Amz-Signature=${"0".repeat(64)}`);
    expect((await fetch(tampered)).status).toBe(403);

    await deleteObjects([key]);
    expect((await fetch(await signedGetUrl(key))).status).toBe(404);
  });

  it("deletes batches larger than one request allows", async () => {
    const keys = Array.from({ length: 1001 }, () => `${crypto.randomUUID()}/thumb`);
    await putObject(keys[1000]!, Buffer.from("last"), "image/webp");
    await deleteObjects(keys);
    expect((await fetch(await signedGetUrl(keys[1000]!))).status).toBe(404);
  });

  it("signs URLs that expire within minutes", async () => {
    const url = new URL(await signedGetUrl(`${crypto.randomUUID()}/thumb`));
    expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(300);
  });
});
