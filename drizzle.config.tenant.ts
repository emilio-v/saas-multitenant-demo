import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schemas/tenant/*.ts",
  out: "./src/db/migrations/tenant",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  // Note: We'll apply these to specific tenant schemas in our migration scripts
});