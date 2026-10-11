import { z } from "zod";

/** Server configuration read from the environment. Parsed once at first use. */
export const serverEnvSchema = z.object({
  APP_URL: z.url({ protocol: /^https?$/ }),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  MAIL_FROM: z.string().min(3),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
