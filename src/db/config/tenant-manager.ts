import { db, getTenantDb } from "./database";
import { tenants } from "../schemas/public/tenants";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export class TenantManager {
  static async createTenant(clerkOrgId: string, name: string, slug: string) {
    const schemaName = `tenant_${slug.replace(/-/g, "_")}`;

    try {
      // Check if tenant already exists
      const existingTenant = await this.getTenantByClerkOrgId(clerkOrgId);
      if (existingTenant) {
        return {
          success: true,
          schemaName: existingTenant.schemaName,
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
    
    // Get all migration files for tenants
    const migrationsPath = './src/db/migrations/tenant';
    const migrationFiles = readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Apply migrations in order
    
    // Apply each migration to the tenant schema
    for (const migrationFile of migrationFiles) {
      console.log(`  🔄 Applying ${migrationFile}...`);
      
      const migrationPath = join(migrationsPath, migrationFile);
      const migrationSql = readFileSync(migrationPath, 'utf8');
      
      // Replace schema placeholders with actual tenant schema name
      const tenantSql = migrationSql.replace(/\$TENANT_SCHEMA\$/g, schemaName);
      
      await db.execute(tenantSql);
    }
    
    console.log(`  ✅ All migrations applied to ${schemaName}`);
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
