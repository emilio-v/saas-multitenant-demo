#!/usr/bin/env bun

/**
 * Empty Database Script
 *
 * This script completely empties the database:
 * - Drops ALL schemas except system ones
 * - Creates fresh public schema
 * - No migrations, no tables - completely empty
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function emptyDatabase() {
  console.log("💣 Emptying Database Completely");
  console.log("===============================");
  console.log("⚠️  This will destroy ALL data!");

  const sql = postgres(DATABASE_URL);

  try {
    // Get all schemas except system ones
    console.log("\n🔍 Finding all schemas...");
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
      AND schema_name NOT LIKE 'pg_%'
    `;

    console.log(`Found ${schemas.length} schemas to drop`);

    // Drop all schemas
    console.log("\n🗑️  Dropping ALL schemas...");
    for (const { schema_name } of schemas) {
      try {
        await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
        console.log(`   ✅ Dropped: ${schema_name}`);
      } catch (error) {
        console.log(`   ⚠️  Error dropping ${schema_name}:`, (error as Error).message);
      }
    }

    // Recreate public schema
    console.log("\n🏗️  Creating fresh public schema...");
    await sql`CREATE SCHEMA IF NOT EXISTS public`;
    await sql`GRANT ALL ON SCHEMA public TO public`;
    console.log("   ✅ Fresh public schema created");

    await sql.end();

    console.log("\n🎉 Database is now COMPLETELY EMPTY!");
    console.log("===================================");
    console.log("✅ All schemas dropped");
    console.log("✅ Fresh public schema created");
    console.log("✅ No tables, no data, no migrations");
    console.log("\nTo rebuild:");
    console.log("• Generate migrations: bun run db:generate:all");
    console.log("• Run migrations: bun run db:migrate:all");
    console.log("• Or use full reset: bun run db:full-reset");
  } catch (error) {
    console.error("\n❌ Empty failed:", error);
    await sql.end();
    process.exit(1);
  }
}

emptyDatabase();
