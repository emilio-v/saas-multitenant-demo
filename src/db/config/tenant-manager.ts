import { db, getTenantDb } from "./database";
import { tenants } from "../schemas/public/tenants";
import { eq } from "drizzle-orm";

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
      await this.createTenantTables(schemaName);

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

  private static async createTenantTables(schemaName: string) {
    const sql = `
      CREATE TABLE IF NOT EXISTS "${schemaName}"."users" (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        avatar_url VARCHAR(500),
        role VARCHAR(50) DEFAULT 'member' NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_seen_at TIMESTAMP,
        joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS "${schemaName}"."projects" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        created_by VARCHAR(255) NOT NULL REFERENCES "${schemaName}"."users"(id),
        is_public BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE INDEX idx_${schemaName}_projects_created_by ON "${schemaName}"."projects"(created_by);
      CREATE INDEX idx_${schemaName}_projects_status ON "${schemaName}"."projects"(status);
      CREATE INDEX idx_${schemaName}_users_role ON "${schemaName}"."users"(role);
    `;

    await db.execute(sql);
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
