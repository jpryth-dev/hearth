// Playwright global setup: a migrated, empty test database with one admin.
import { execFileSync } from "node:child_process";

import { Client } from "pg";

import migrateTestDatabase from "./global-setup";
import { E2E_ADMIN, E2E_MEMBERS } from "./e2e-users";
import { testDatabaseUrl } from "./test-database-url";

export default async function setup(): Promise<void> {
  await migrateTestDatabase();
  const url = testDatabaseUrl();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'",
    );
    // Table names come from the catalog; the database name was checked above.
    await client.query(`truncate table ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`);
    for (const m of Object.values(E2E_MEMBERS)) {
      await client.query(
        "insert into users (id, email, display_name, updated_at) values (gen_random_uuid(), $1, $2, now())",
        [m.email, m.name],
      );
    }
  } finally {
    await client.end();
  }

  execFileSync("npx", ["tsx", "scripts/create-admin.ts", "--email", E2E_ADMIN.email, "--name", E2E_ADMIN.name], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
