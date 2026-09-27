// Runs in each integration worker before test files load, so the db client
// (created on import) connects to the test database rather than dev.
import { testDatabaseUrl } from "./test-database-url";

process.env.DATABASE_URL = testDatabaseUrl();
