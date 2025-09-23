#!/usr/bin/env bun

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db/config/database";

async function migratePublic() {
  console.log("🚀 Starting public schema migration...");

  try {
    await migrate(db, {
      migrationsFolder: "./src/db/migrations/public",
    });

    console.log("✅ Public schema migration completed successfully!");
  } catch (error) {
    console.error("❌ Public schema migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migratePublic();
