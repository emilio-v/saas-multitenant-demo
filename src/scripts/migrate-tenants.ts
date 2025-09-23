#!/usr/bin/env bun

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { db } from "../db/config/database";
import { TenantManager } from "../db/config/tenant-manager";
import { getTenantDb } from "../db/config/database";
import { sql } from "drizzle-orm";

async function migrateTenants() {
  console.log("🚀 Starting tenant schema migrations...");

  try {
    // Get all existing tenants
    const tenants = await TenantManager.getAllTenants();
    console.log(`📋 Found ${tenants.length} tenants to migrate`);

    if (tenants.length === 0) {
      console.log("⚠️  No tenants found. Nothing to migrate.");
      return;
    }

    // Get all migration files for tenants
    const migrationsPath = "./src/db/migrations/tenant";
    const migrationFiles = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Apply migrations in order

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    for (const tenant of tenants) {
      console.log(`🔄 Migrating tenant: ${tenant.name} (${tenant.schemaName})`);

      // Get tenant-specific database connection
      const tenantDb = getTenantDb(tenant.schemaName);

      // Create schema if it doesn't exist
      await db.execute(`CREATE SCHEMA IF NOT EXISTS "${tenant.schemaName}"`);

      // Create migrations tracking table if it doesn't exist
      await tenantDb.execute(`
        CREATE TABLE IF NOT EXISTS "_migrations" (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Check if tables already exist (for existing tenants)
      const tablesExist = await tenantDb.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        ) as users_exists
      `);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasExistingTables = (tablesExist[0] as any).users_exists;

      // Get already applied migrations
      const appliedMigrations = await tenantDb.execute(`
        SELECT filename FROM "_migrations"
      `);
      const appliedSet = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appliedMigrations.map((row: any) => row.filename)
      );

      // If tables exist but no migration records, mark initial migration as applied
      if (hasExistingTables && appliedSet.size === 0) {
        console.log(`  📋 Marking existing tables as migrated...`);
        await tenantDb.execute(`
          INSERT INTO "_migrations" (filename) VALUES ('0000_steep_hedge_knight.sql')
          ON CONFLICT (filename) DO NOTHING
        `);
        appliedSet.add("0000_steep_hedge_knight.sql");
      }

      // Apply each migration to the tenant schema
      for (const migrationFile of migrationFiles) {
        if (appliedSet.has(migrationFile)) {
          console.log(`  ⏭️  Skipping ${migrationFile} (already applied)`);
          continue;
        }

        console.log(`  📝 Applying ${migrationFile}...`);

        const migrationPath = join(migrationsPath, migrationFile);
        const migrationSql = readFileSync(migrationPath, "utf8");

        // Replace schema placeholders with actual tenant schema name
        const tenantSql = migrationSql.replace(
          /\$TENANT_SCHEMA\$/g,
          tenant.schemaName
        );

        await tenantDb.execute(tenantSql);

        // Record that this migration has been applied
        await tenantDb.execute(sql`
          INSERT INTO "_migrations" (filename) VALUES (${migrationFile})
        `);
      }

      console.log(`  ✅ ${tenant.name} migration completed`);
    }

    console.log("🎉 All tenant migrations completed successfully!");
  } catch (error) {
    console.error("❌ Tenant migrations failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateTenants();
