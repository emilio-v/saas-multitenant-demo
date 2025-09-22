import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schemas/public/*.ts",
  out: "./src/db/migrations/public",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});