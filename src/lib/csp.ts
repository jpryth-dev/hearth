import type { StorageEnv } from "@/lib/schemas";

export interface CspOptions {
  nonce: string;
  /** `next dev` needs eval for React's debugging stacks; production never does. */
  isDev: boolean;
  /** Served over https: enables upgrade-insecure-requests. */
  https: boolean;
  /** Where signed photo URLs point. */
  imageOrigins: string[];
}

/**
 * The Content-Security-Policy for every page. Scripts run only with this
 * request's nonce (and what they load, via strict-dynamic); images come only
 * from the app and the photo bucket; nothing may frame the app.
 */
export function buildCsp({ nonce, isDev, https, imageOrigins }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    ["img-src 'self' data: blob:", ...imageOrigins].join(" "),
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

/**
 * The origin the S3 SDK puts in signed photo URLs for this configuration:
 * the endpoint itself for path-style (RustFS, R2, MinIO), or a bucket
 * subdomain for virtual-hosted style (AWS default).
 */
export function storageImageOrigin(
  env: Pick<StorageEnv, "S3_ENDPOINT" | "S3_BUCKET" | "S3_REGION" | "S3_FORCE_PATH_STYLE">,
): string {
  const endpoint = new URL(env.S3_ENDPOINT ?? `https://s3.${env.S3_REGION}.amazonaws.com`);
  if (env.S3_FORCE_PATH_STYLE) return endpoint.origin;
  return `${endpoint.protocol}//${env.S3_BUCKET}.${endpoint.host}`;
}
