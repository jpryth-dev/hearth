// Runs once before the integration project: create the test database if it
// is missing, then bring it to the latest migration.
import { execFileSync } from "node:child_process";

import { Client } from "pg";

import { testDatabaseUrl } from "./test-database-url";

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const target = new URL(url);
  const name = target.pathname.slice(1);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (rowCount === 0) {
      // Identifiers can't be parameterised; name was validated by testDatabaseUrl.
      await client.query(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
