// Runs in each integration worker before test files load, so the db client
// and storage client (created on first use) point at test resources, not dev.
import { testDatabaseUrl } from "./test-database-url";

process.env.DATABASE_URL = testDatabaseUrl();
if (!process.env.TEST_S3_BUCKET) throw new Error("TEST_S3_BUCKET is not set (see .env.example)");
process.env.S3_BUCKET = process.env.TEST_S3_BUCKET;
