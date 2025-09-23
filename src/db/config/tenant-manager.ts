import { db, getTenantDb } from "./database";
import { tenants } from "../schemas/public/tenants";
import { eq, sql } from "drizzle-orm";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export class TenantManager {
  static async createTenant(clerkOrgId: string, name: string, slug: string) {
    const schemaName = `tenant_${slug.replace(/-/g, "_")}`;

    try {
      // Check if tenant already exists by clerkOrgId
      const existingTenantById = await this.getTenantByClerkOrgId(clerkOrgId);
      if (existingTenantById) {
        // Ensure migrations are applied even for existing tenants
        await db.execute(`CREATE SCHEMA IF NOT EXISTS "${existingTenantById.schemaName}"`);
        await this.applyTenantMigrations(existingTenantById.schemaName);
        return {
          success: true,
          schemaName: existingTenantById.schemaName,
          existing: true,
        };
      }

      // Check if tenant already exists by slug (unique constraint)
      const existingTenantBySlug = await this.getTenantBySlug(slug);
      if (existingTenantBySlug) {
        console.log(`⚠️  Tenant with slug '${slug}' already exists for different organization`);
        // Update the existing tenant record with the new clerkOrgId
        await db.update(tenants)
          .set({ id: clerkOrgId, name, updatedAt: new Date() })
          .where(eq(tenants.slug, slug));
        
        // Ensure migrations are applied
        await db.execute(`CREATE SCHEMA IF NOT EXISTS "${existingTenantBySlug.schemaName}"`);
        await this.applyTenantMigrations(existingTenantBySlug.schemaName);
        return {
          success: true,
          schemaName: existingTenantBySlug.schemaName,
          existing: true,
        };
      }

      await db.insert(tenants).values({
        id: clerkOrgId,
        name,
        slug,
        schemaName,
      });

      await db.execute(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await this.applyTenantMigrations(schemaName);

      return { success: true, schemaName };
    } catch (error) {
      // Only drop tenant if it wasn't already existing
      const existingTenant = await this.getTenantByClerkOrgId(clerkOrgId);
      if (!existingTenant) {
        await this.dropTenant(schemaName);
      }
      throw error;
    }
  }

  private static async applyTenantMigrations(schemaName: string) {
    console.log(`📝 Applying migrations to tenant: ${schemaName}`);

    try {
      // Get all migration files for tenants
      const migrationsPath = join(process.cwd(), "src/db/migrations/tenant");
      console.log(`🔍 Looking for migrations in: ${migrationsPath}`);
      console.log(`🔍 Current working directory: ${process.cwd()}`);
      
      // Check if directory exists and get migration files
      let migrationFiles: string[];
      try {
        migrationFiles = readdirSync(migrationsPath)
          .filter((file) => file.endsWith(".sql"))
          .sort(); // Apply migrations in order
        
        console.log(`📁 Found ${migrationFiles.length} migration files:`, migrationFiles);
      } catch (dirError) {
        console.error(`❌ Cannot access migrations directory:`, dirError);
        try {
          console.log(`🔍 Contents of src/db/migrations:`, 
            readdirSync(join(process.cwd(), "src/db/migrations")));
        } catch {
          console.log(`🔍 src/db/migrations directory not found`);
        }
        
        try {
          console.log(`🔍 Project root contents:`, readdirSync(process.cwd()));
        } catch {
          console.log(`🔍 Cannot read project root`);
        }
        throw new Error(`Migration directory not accessible: ${migrationsPath}`);
      }

      // Get tenant-specific database connection with correct search_path
      const tenantDb = getTenantDb(schemaName);

    // Create migrations tracking table if it doesn't exist
    await tenantDb.execute(`
      CREATE TABLE IF NOT EXISTS "${schemaName}"."_migrations" (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const appliedMigrations = await tenantDb.execute(`
      SELECT filename FROM "${schemaName}"."_migrations"
    `);
    const appliedSet = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appliedMigrations.map((row: any) => row.filename)
    );

    // Apply each migration to the tenant schema
    for (const migrationFile of migrationFiles) {
      if (appliedSet.has(migrationFile)) {
        console.log(`  ⏭️  Skipping ${migrationFile} (already applied)`);
        continue;
      }

      console.log(`  🔄 Applying ${migrationFile}...`);

      try {
        const migrationPath = join(migrationsPath, migrationFile);
        console.log(`    📄 Reading migration from: ${migrationPath}`);
        
        const migrationSql = readFileSync(migrationPath, "utf8");
        console.log(`    📝 Migration SQL length: ${migrationSql.length} characters`);

        // Replace schema placeholders with actual tenant schema name
        const tenantSql = migrationSql.replace(/\$TENANT_SCHEMA\$/g, schemaName);
        console.log(`    🔄 Executing migration for schema: ${schemaName}`);

        // Execute migration with tenant-specific connection
        await tenantDb.execute(tenantSql);
        console.log(`    ✅ Migration ${migrationFile} executed successfully`);
      } catch (migrationError) {
        console.error(`    ❌ Failed to apply migration ${migrationFile}:`, migrationError);
        throw migrationError;
      }

      // Record that this migration has been applied
      await tenantDb.execute(sql`
        INSERT INTO ${sql.raw(`"${schemaName}"."_migrations"`)} (filename) VALUES (${migrationFile})
      `);
    }

    console.log(`  ✅ All migrations applied to ${schemaName}`);
    } catch (error) {
      console.error(`❌ Failed to apply migrations to ${schemaName}:`, error);
      if (error instanceof Error) {
        console.error(`Migration error details:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      throw error;
    }
  }

  static async getTenantBySlug(slug: string) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return tenant;
  }

  static async getTenantById(id: string) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return tenant;
  }

  static async getTenantByClerkOrgId(clerkOrgId: string) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, clerkOrgId))
      .limit(1);

    return tenant;
  }

  static async getAllTenants() {
    return await db.select().from(tenants);
  }

  private static async dropTenant(schemaName: string) {
    try {
      await db.execute(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await db.delete(tenants).where(eq(tenants.schemaName, schemaName));
    } catch (error) {
      console.error("Error dropping tenant:", error);
    }
  }
}
