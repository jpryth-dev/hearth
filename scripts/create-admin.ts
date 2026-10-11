// Creates the first admin, who can then invite everyone else. This and
// invitation acceptance are the only ways a user comes into existence.
//
//   npm run admin:create -- --email you@example.com --name "Your Name"
//
// The new admin signs in with an emailed link; there is no password.
import "dotenv/config";

import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { ZodError, prettifyError } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";
import { displayNameSchema, emailSchema } from "../src/lib/schemas/auth";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  });
  const email = emailSchema.parse(values.email);
  const displayName = displayNameSchema.parse(values.name);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    if (await db.user.findUnique({ where: { email } })) {
      throw new Error(`A user with ${email} already exists`);
    }
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, displayName, role: "ADMIN" } });
      await tx.auditLog.create({
        data: {
          action: "USER_CREATED",
          actorUserId: null,
          targetType: "user",
          targetId: created.id,
          details: { via: "admin:create script", role: "ADMIN" },
        },
      });
      return created;
    });
    console.log(`Created admin ${user.email}. Sign in at /login.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof ZodError) console.error(prettifyError(error));
  else console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
