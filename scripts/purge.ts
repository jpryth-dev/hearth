// Daily maintenance: permanently remove soft-deleted photos and albums past
// the retention period, and expired sessions and sign-in links.
//
//   npm run purge
//
// Schedule it with cron (or the host's scheduler) once a day.
import "dotenv/config";

import { purgeExpired } from "@/server/data/retention";
import { db } from "@/server/db";

async function main(): Promise<void> {
  try {
    const report = await purgeExpired({ kind: "system", name: "purge script" });
    console.log(JSON.stringify(report));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
