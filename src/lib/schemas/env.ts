import { z } from "zod";

/** Server configuration read from the environment. Parsed once at first use. */
export const serverEnvSchema = z.object({
  APP_URL: z.url({ protocol: /^https?$/ }),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  MAIL_FROM: z.string().min(3),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Object storage configuration. Separate from serverEnv so sign-in works without it. */
export const storageEnvSchema = z.object({
  S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;
