// Prisma 7 configuration. Connection URLs no longer live in schema.prisma.
// Prisma 7 does not load .env on its own, so dotenv is imported explicitly.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
