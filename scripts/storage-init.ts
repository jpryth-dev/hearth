// Creates the photo bucket (and the test bucket, if configured) when missing.
// Development and CI only: production buckets are created in the provider's
// console with public access off.
import "dotenv/config";

import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

import { storageEnvSchema } from "../src/lib/schemas/env";

async function main(): Promise<void> {
  const env = storageEnvSchema.parse(process.env);
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  const buckets = [env.S3_BUCKET, process.env.TEST_S3_BUCKET].filter((b): b is string => !!b);

  for (const bucket of buckets) {
    // The storage container may still be starting.
    for (let attempt = 1; ; attempt++) {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        console.log(`Bucket ${bucket} exists.`);
        break;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          console.log(`Created bucket ${bucket}.`);
          break;
        }
        if (attempt >= 30) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
