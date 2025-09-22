#!/usr/bin/env bun

import { execSync } from "child_process";

async function migrateAll() {
  console.log("🚀 Starting complete database migration...");
  console.log("=====================================");

  try {
    // 1. Migrate public schema first
    console.log("📦 Step 1: Migrating public schema...");
    execSync("bun run src/scripts/migrate-public.ts", { stdio: "inherit" });

    console.log("\n📦 Step 2: Migrating tenant schemas...");
    execSync("bun run src/scripts/migrate-tenants.ts", { stdio: "inherit" });

    console.log("\n🎉 All migrations completed successfully!");
    console.log("=====================================");
  } catch (error) {
    console.error("❌ Migration process failed:", error);
    process.exit(1);
  }
}

migrateAll();
