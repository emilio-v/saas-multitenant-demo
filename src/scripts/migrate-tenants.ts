#!/usr/bin/env bun

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { db } from "../db/config/database";
import { TenantManager } from "../db/config/tenant-manager";

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

      // Create schema if it doesn't exist
      await db.execute(`CREATE SCHEMA IF NOT EXISTS "${tenant.schemaName}"`);

      // Apply each migration to the tenant schema
      for (const migrationFile of migrationFiles) {
        console.log(`  📝 Applying ${migrationFile}...`);

        const migrationPath = join(migrationsPath, migrationFile);
        const migrationSql = readFileSync(migrationPath, "utf8");

        // Replace schema placeholders with actual tenant schema name
        const tenantSql = migrationSql.replace(
          /\$TENANT_SCHEMA\$/g,
          tenant.schemaName
        );

        await db.execute(tenantSql);
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
