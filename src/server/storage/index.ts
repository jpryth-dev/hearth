/**
 * Object storage for photo files. Only the data-access layer calls this, and
 * only after an album check.
 *
 * Contract:
 * - The bucket is private. Files are reachable only through signed URLs from
 *   `signedGetUrl`, which expire in minutes and are never cached or logged.
 * - Keys are supplied by the caller and must be derived from a random
 *   `Photo.storageKey` UUID; this module does not invent or accept
 *   user-derived keys.
 *
 * @packageDocumentation
 */
import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { storageEnvSchema, type StorageEnv } from "@/lib/schemas";

/** How long a signed photo URL works. */
export const SIGNED_URL_TTL_SECONDS = 300;

let cached: { env: StorageEnv; client: S3Client } | undefined;

function storage() {
  if (!cached) {
    const env = storageEnvSchema.parse(process.env);
    const client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    cached = { env, client };
  }
  return cached;
}

/** Stores one object. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { env, client } = storage();
  await client.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

/** Deletes objects; missing keys are not an error. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { env, client } = storage();
  await client.send(
    new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
  );
}

/**
 * A short-lived URL for reading one object. Call only after the caller has
 * passed the album access check, and never log or cache the result.
 */
export async function signedGetUrl(key: string): Promise<string> {
  const { env, client } = storage();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ResponseCacheControl: `private, max-age=${SIGNED_URL_TTL_SECONDS}`,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}
