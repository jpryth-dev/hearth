import "dotenv/config";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts", "prisma/**/*.int.test.ts"],
          globalSetup: ["tests/global-setup.ts"],
          setupFiles: ["tests/integration-setup.ts"],
          // Tests share one database; running files in parallel would race on resets.
          fileParallelism: false,
        },
      },
    ],
  },
});
