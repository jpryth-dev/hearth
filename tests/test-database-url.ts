// Integration tests truncate tables. Refusing any database not named *_test
// keeps a misconfigured env from wiping dev or production data.
export function testDatabaseUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  }
  const name = new URL(raw).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL must name a *_test database, got "${name}"`);
  }
  return raw;
}
