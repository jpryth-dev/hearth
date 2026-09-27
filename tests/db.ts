import { db } from "@/server/db";

/**
 * Empties every application table so each integration test starts clean.
 * Checks the connected database name first, so it can never run against a
 * non-test database even if the env is wrong.
 */
export async function resetDatabase(): Promise<void> {
  const [current] = await db.$queryRaw<{ name: string }[]>`select current_database() as name`;
  if (!current?.name.endsWith("_test")) {
    throw new Error(`Refusing to reset non-test database "${current?.name}"`);
  }
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  // Table names come from the catalog, not user input.
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`truncate table ${list} restart identity cascade`);
}
