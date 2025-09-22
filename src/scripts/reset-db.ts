#!/usr/bin/env bun

/**
 * Database Reset Script
 * 
 * This script performs a complete database reset:
 * 1. Drops all tenant schemas
 * 2. Resets public schema migrations
 * 3. Runs fresh migrations for public schema
 * 4. Ready for new tenant creation
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function resetDatabase() {
  console.log("🔄 Starting Database Reset");
  console.log("==========================");
  
  const sql = postgres(DATABASE_URL!, { max: 1 });
  
  try {
    // Step 1: Get all existing tenants before dropping (if table exists)
    console.log("\n📋 Checking existing tenants...");
    let existingTenants: { schemaName: string }[] = [];
    try {
      const tenantsResult = await sql`SELECT id, name, schema_name FROM public.tenants`;
      existingTenants = tenantsResult.map(t => ({ schemaName: t.schema_name as string }));
      console.log(`Found ${existingTenants.length} existing tenants`);
    } catch {
      console.log("   ℹ️  No existing tenants table found (starting fresh)");
    }
    
    // Step 2: Get all schemas that start with 'tenant_' directly from database
    console.log("\n🔍 Finding all tenant schemas in database...");
    const schemaResult = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `;
    console.log(`Found ${schemaResult.length} tenant schemas in database`);
    
    // Step 3: Drop all tenant schemas (from both sources)
    const allSchemas = new Set([
      ...existingTenants.map(t => t.schemaName),
      ...schemaResult.map(s => s.schema_name)
    ]);
    
    if (allSchemas.size > 0) {
      console.log("\n🗑️  Dropping tenant schemas...");
      for (const schemaName of allSchemas) {
        try {
          await sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
          console.log(`   ✅ Dropped schema: ${schemaName}`);
        } catch (error) {
          console.log(`   ⚠️  Warning dropping schema ${schemaName}:`, (error as Error).message);
        }
      }
    }
    
    // Step 4: Drop and recreate public schema tables
    console.log("\n🔄 Resetting public schema...");
    await sql`DROP TABLE IF EXISTS public.tenants CASCADE`;
    await sql`DROP TABLE IF EXISTS public.__drizzle_migrations CASCADE`;
    console.log("   ✅ Dropped public tables");
    
    // Step 5: Run public schema migrations
    console.log("\n📦 Running public schema migrations...");
    const publicDb = drizzle(sql);
    const publicMigrationsPath = path.resolve(process.cwd(), "src/db/migrations/public");
    
    await migrate(publicDb, { migrationsFolder: publicMigrationsPath });
    console.log("   ✅ Public schema migrations completed");
    
    // Step 6: Verify setup
    console.log("\n✨ Verifying database setup...");
    const result = await sql`SELECT COUNT(*) as count FROM public.tenants`;
    console.log(`   ✅ Tenants table ready (${result[0].count} records)`);
    
    await sql.end();
    
    console.log("\n🎉 Database Reset Complete!");
    console.log("============================");
    console.log("✅ All tenant schemas dropped");
    console.log("✅ Public schema reset");
    console.log("✅ Fresh migrations applied");
    console.log("✅ Ready for new tenant creation");
    console.log("\nYou can now:");
    console.log("• Start the app: bun run dev");
    console.log("• Create new organizations through the UI");
    
  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    await sql.end();
    process.exit(1);
  }
}

// Run the reset
resetDatabase();