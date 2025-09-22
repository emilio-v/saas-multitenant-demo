#!/usr/bin/env bun

import { db } from "../src/db/config/database";
import { tenants } from "../src/db/schemas/public/tenants";

async function resetDatabase() {
  console.log("🔄 Starting database reset...");
  
  try {
    // Get all existing tenants to drop their schemas
    console.log("📋 Fetching all tenants...");
    const existingTenants = await db.select().from(tenants);
    
    // Drop all tenant schemas
    for (const tenant of existingTenants) {
      console.log(`🗑️  Dropping schema: ${tenant.schemaName}`);
      await db.execute(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    }
    
    // Drop and recreate public schema tables
    console.log("🗑️  Dropping public schema tables...");
    await db.execute(`DROP TABLE IF EXISTS public.tenants CASCADE`);
    
    // Recreate public schema tables
    console.log("🏗️  Recreating public schema tables...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        schema_name VARCHAR(63) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    console.log("✅ Database reset completed successfully!");
    console.log("📊 Summary:");
    console.log(`   • Dropped ${existingTenants.length} tenant schemas`);
    console.log(`   • Recreated public.tenants table`);
    console.log(`   • Database is now clean and ready for fresh data`);
    
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the reset
resetDatabase();