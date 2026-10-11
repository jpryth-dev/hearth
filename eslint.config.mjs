import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const prismaClientImport = {
  name: "@prisma/client",
  message: "Import from @/generated/prisma.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { paths: [prismaClientImport] }],
    },
  },
  {
    // Album and photo data is reached only through
    // src/server/data/, so nothing outside src/server/ may touch the client.
    files: ["src/**"],
    ignores: ["src/server/**", "src/generated/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [prismaClientImport],
          patterns: [
            {
              group: ["@/server/db", "**/server/db", "@/generated/prisma/client", "**/generated/prisma/client"],
              message: "Use the data-access layer in src/server/data/ instead of the database client.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
