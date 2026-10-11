import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";

import { buildCsp, storageImageOrigin } from "./csp";

describe("buildCsp", () => {
  const base = { nonce: "abc123", isDev: false, https: true, imageOrigins: ["https://photos.example"] };

  it("locks scripts to the nonce and images to the bucket", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("img-src 'self' data: blob: https://photos.example");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("allows eval only in development, and skips the https upgrade over http", () => {
    const csp = buildCsp({ ...base, isDev: true, https: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("storageImageOrigin matches the origin of real signed URLs", () => {
  const configs = [
    { name: "RustFS (path style)", S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: true, S3_REGION: "us-east-1" },
    { name: "R2 (path style)", S3_ENDPOINT: "https://acct123.r2.cloudflarestorage.com", S3_FORCE_PATH_STYLE: true, S3_REGION: "auto" },
    { name: "AWS (virtual host)", S3_ENDPOINT: undefined, S3_FORCE_PATH_STYLE: false, S3_REGION: "eu-west-2" },
  ];

  it.each(configs)("$name", async ({ S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_REGION }) => {
    const S3_BUCKET = "hearth-photos";
    const client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: "k", secretAccessKey: "s" },
    });
    const signed = await getSignedUrl(client, new GetObjectCommand({ Bucket: S3_BUCKET, Key: "x/full" }), { expiresIn: 60 });
    expect(storageImageOrigin({ S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_FORCE_PATH_STYLE })).toBe(new URL(signed).origin);
  });
});
