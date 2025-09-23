# Complete Multi-Tenant SaaS Guide with PostgreSQL Schema Isolation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Initial Setup](#initial-setup)
4. [Clerk Authentication Setup](#clerk-authentication-setup)
5. [Database Configuration](#database-configuration)
6. [Migration System](#migration-system)
7. [Implementation Steps](#implementation-steps)
8. [Webhook Integration](#webhook-integration)
9. [User Interface](#user-interface)
10. [API Routes](#api-routes)
11. [Best Practices](#best-practices)
12. [Deployment & Production](#deployment--production)
13. [Troubleshooting](#troubleshooting)

## Overview

This guide covers building a production-ready multi-tenant SaaS application with complete data isolation using PostgreSQL schema-per-tenant architecture.

### Technology Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with schema-per-tenant isolation
- **ORM**: Drizzle ORM with type-safe queries
- **Authentication**: Clerk with Organizations support
- **UI**: Shadcn/ui + Tailwind CSS v4
- **Build Tool**: Turbopack for fast development

### Key Features

- ✅ Complete data isolation per tenant
- ✅ Automated tenant provisioning via webhooks
- ✅ Robust migration system with tracking
- ✅ Role-based permissions (owner, admin, member, viewer)
- ✅ Subdomain-based tenant routing
- ✅ Type-safe database operations
- ✅ Production-ready error handling

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Architecture                │
└─────────────────────────────────────────────────────────────┘

Client Layer:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   acme.app.com  │  │ testcorp.app.com│  │  demo.app.com   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
Application Layer:
                    ┌────────────┴────────────┐
                    │   Next.js Application   │
                    │  - Middleware (Tenant)  │
                    │  - Clerk Auth           │
                    │  - Webhook Handler      │
                    └────────────┬────────────┘
                                 │
Database Layer:
                    ┌────────────┴────────────┐
                    │   PostgreSQL Database   │
                    ├─────────────────────────┤
                    │  public schema          │
                    │  - tenants table        │
                    │  - shared metadata      │
                    ├─────────────────────────┤
                    │  tenant_acme            │
                    │  - users, projects      │
                    │  - _migrations table    │
                    ├─────────────────────────┤
                    │  tenant_testcorp        │
                    │  - users, projects      │
                    │  - _migrations table    │
                    └─────────────────────────┘
```

## Initial Setup

### 1. Project Creation

```bash
# Create Next.js project with Bun
bunx create-next-app@latest saas-multitenant-demo --typescript --tailwind --eslint --app --src-dir

cd saas-multitenant-demo
```

### 2. Dependencies Installation

```bash
# Core dependencies
bun add @clerk/nextjs drizzle-orm postgres svix

# UI dependencies  
bun add @radix-ui/react-label @radix-ui/react-slot
bun add class-variance-authority clsx lucide-react tailwind-merge

# Development dependencies
bun add -d drizzle-kit @types/node
```

### 3. Shadcn/ui Setup

```bash
bunx shadcn@latest init

# Install required components
bunx shadcn@latest add button card input label
```

### 4. Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── tenants/[slug]/users/
│   │   └── webhooks/clerk/
│   ├── auth/
│   │   ├── sign-in/[[...sign-in]]/
│   │   ├── sign-up/[[...sign-up]]/
│   │   └── onboarding/
│   ├── [tenant]/
│   │   ├── dashboard/
│   │   └── projects/
│   └── layout.tsx
├── components/
│   ├── auth/onboarding/
│   └── ui/
├── db/
│   ├── config/
│   │   ├── database.ts
│   │   └── tenant-manager.ts
│   ├── schemas/
│   │   ├── public/tenants.ts
│   │   └── tenant/users.ts
│   └── migrations/
│       ├── public/
│       └── tenant/
├── lib/
│   └── permissions.ts
├── scripts/
│   ├── migrate-all.ts
│   ├── migrate-tenants.ts
│   └── reset-db.ts
└── middleware.ts
```

## Clerk Authentication Setup

### 1. Clerk Dashboard Configuration

1. **Create Clerk Application**
   - Go to [clerk.com](https://clerk.com)
   - Create new application
   - Select "Email" as primary authentication

2. **Enable Organizations**
   - Navigate to Organizations → Settings
   - ✅ Enable organizations
   - ✅ Limit members to 1 organization
   - Configure roles: owner, admin, member, viewer

3. **Webhook Configuration**
   - Go to Webhooks → Create Endpoint
   - URL: `https://yourdomain.com/api/webhooks/clerk`
   - Events: `organization.created`, `user.created`
   - Copy webhook secret

### 2. Environment Variables

Create `.env.local`:

```bash
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/onboarding

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/saas_multitenant

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Root Layout Setup

```tsx
// src/app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs'
import { GeistSans, GeistMono } from 'geist/font'
import './globals.css'

export const metadata = {
  title: 'Multi-Tenant SaaS Demo',
  description: 'Production-ready multi-tenant SaaS application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

## Database Configuration

The application is designed to work with any PostgreSQL-compatible database through schema-aware operations and explicit schema references.

**Supported Database Providers:**
- Docker PostgreSQL 12+
- Supabase (Managed PostgreSQL)
- AWS RDS PostgreSQL
- Google Cloud SQL PostgreSQL
- Azure Database for PostgreSQL
- Any PostgreSQL instance with schema support

**Cross-Provider Compatibility:**
All database operations use explicit schema references and schema-aware table factory functions to ensure consistent behavior across different PostgreSQL providers.

### 1. Database Schema Design

```typescript
// src/db/schemas/public/tenants.ts
import { pgTable, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 255 }).primaryKey(), // clerk_org_id
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  schemaName: varchar("schema_name", { length: 63 }).unique().notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

```typescript
// src/db/schemas/tenant/users.ts (DRY principle implementation)
import {
  pgTable,
  pgSchema,
  varchar,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

// Create a tenant schema for migration generation
export const tenantSchema = pgSchema("tenant");

// Schema definition for DRY principle - shared between static and dynamic usage
const usersTableSchema = {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  metadata: jsonb("metadata").default("{}").notNull(),
  isActive: boolean("is_active").default(true),
  lastSeenAt: timestamp("last_seen_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

// Static export for Drizzle Kit migration generation
export const users = tenantSchema.table("users", usersTableSchema);

// Factory function for runtime tenant creation
export const createUsersTable = (schemaName?: string) => {
  if (schemaName) {
    const schema = pgSchema(schemaName);
    return schema.table("users", usersTableSchema);
  }
  return pgTable("users", usersTableSchema);
};
```

### 2. Database Connection Management

```typescript
// src/db/config/database.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Main connection pool for public schema
const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql);

// Tenant connection cache with proper cleanup
const tenantConnections = new Map<string, ReturnType<typeof postgres>>();
const tenantDbs = new Map<string, ReturnType<typeof drizzle>>();

export function getTenantDb(schemaName: string) {
  if (!tenantDbs.has(schemaName)) {
    const tenantSql = postgres(process.env.DATABASE_URL!, {
      max: 5,
      idle_timeout: 60,
      connection: {
        search_path: schemaName,
      },
    });
    
    const tenantDb = drizzle(tenantSql);
    
    tenantConnections.set(schemaName, tenantSql);
    tenantDbs.set(schemaName, tenantDb);
  }
  
  return tenantDbs.get(schemaName)!;
}

export async function closeTenantConnection(schemaName: string) {
  const sql = tenantConnections.get(schemaName);
  if (sql) {
    await sql.end();
    tenantConnections.delete(schemaName);
    tenantDbs.delete(schemaName);
  }
}
```

### 3. Drizzle Configuration

```typescript
// drizzle.config.public.ts
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./src/db/schemas/public/*.ts",
  out: "./src/db/migrations/public",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

```typescript
// drizzle.config.tenant.ts
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./src/db/schemas/tenant/*.ts",
  out: "./src/db/migrations/tenant",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

## Migration System

### 1. Tenant Manager with Advanced Migration Tracking

```typescript
// src/db/config/tenant-manager.ts
import { db, getTenantDb } from "./database";
import { tenants } from "../schemas/public/tenants";
import { eq } from "drizzle-orm";
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
    
    // Get all migration files for tenants
    const migrationsPath = "./src/db/migrations/tenant";
    const migrationFiles = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Apply migrations in order
    
    // Get tenant-specific database connection
    const tenantDb = getTenantDb(schemaName);
    
    // Create migrations tracking table if it doesn't exist
    await tenantDb.execute(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const appliedMigrations = await tenantDb.execute(`
      SELECT filename FROM "_migrations"
    `);
    const appliedSet = new Set(
      appliedMigrations.map((row: any) => row.filename)
    );
    
    // Apply each migration to the tenant schema
    for (const migrationFile of migrationFiles) {
      if (appliedSet.has(migrationFile)) {
        console.log(`  ⏭️  Skipping ${migrationFile} (already applied)`);
        continue;
      }

      console.log(`  🔄 Applying ${migrationFile}...`);
      
      const migrationPath = join(migrationsPath, migrationFile);
      const migrationSql = readFileSync(migrationPath, "utf8");
      
      // Replace schema placeholders with actual tenant schema name
      const tenantSql = migrationSql.replace(/\$TENANT_SCHEMA\$/g, schemaName);
      
      // Execute migration with tenant-specific connection
      await tenantDb.execute(tenantSql);

      // Record that this migration has been applied
      await tenantDb.execute(`
        INSERT INTO "_migrations" (filename) VALUES ('${migrationFile}')
      `);
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
```

#### Robustness Features

The `TenantManager.createTenant()` method includes several robustness features for production environments:

**1. Existing Tenant Handling**
- **By Organization ID**: If the same Clerk organization calls the webhook multiple times, it ensures migrations are applied
- **By Slug**: If an organization is deleted and recreated in Clerk with the same name, it updates the existing tenant record with the new organization ID

**2. Migration Consistency**
- Always applies missing migrations for existing tenants
- Creates schema if it doesn't exist (handles partial creation scenarios)  
- Idempotent migration tracking prevents duplicate applications

**3. Production Edge Cases**
- **Webhook retry scenarios**: Handles multiple webhook deliveries gracefully
- **Organization recreation**: Seamlessly handles Clerk org deletion/recreation
- **Schema drift**: Ensures existing tenants get latest schema updates
- **Partial failures**: Recovers from incomplete tenant creation

This ensures robust operation across different deployment scenarios, database providers (Docker PostgreSQL, Supabase), and Clerk webhook behavior.

### 2. Migration Scripts

```typescript
// src/scripts/migrate-tenants.ts
#!/usr/bin/env bun

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { db } from "../db/config/database";
import { TenantManager } from "../db/config/tenant-manager";
import { getTenantDb } from "../db/config/database";

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

      const hasExistingTables = (tablesExist[0] as any).users_exists;

      // Get already applied migrations
      const appliedMigrations = await tenantDb.execute(`
        SELECT filename FROM "_migrations"
      `);
      const appliedSet = new Set(
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
        await tenantDb.execute(`
          INSERT INTO "_migrations" (filename) VALUES ('${migrationFile}')
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
```

### 3. Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint",
    "db:reset": "bun run src/scripts/reset-db.ts",
    "db:empty": "bun run src/scripts/db-empty.ts",
    "db:generate:public": "drizzle-kit generate --config=drizzle.config.public.ts",
    "db:generate:tenant": "drizzle-kit generate --config=drizzle.config.tenant.ts",
    "db:generate:all": "bun run db:generate:public && bun run db:generate:tenant",
    "db:migrate:public": "bun run src/scripts/migrate-public.ts",
    "db:migrate:tenants": "bun run src/scripts/migrate-tenants.ts",
    "db:migrate:all": "bun run src/scripts/migrate-all.ts"
  }
}
```

## Webhook Integration

### 1. Clerk Webhook Handler

```typescript
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { TenantManager } from "@/db/config/tenant-manager";
import { getTenantDb } from "@/db/config/database";
import { createUsersTable } from "@/db/schemas/tenant";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  console.log("🎣 [Webhook] Received Clerk webhook request");

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log("❌ [Webhook] Missing svix headers");
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.text();
  const body = JSON.parse(payload);

  // Create a new Svix instance with your secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log("❌ [Webhook] No webhook secret configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("❌ [Webhook] Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  console.log("✅ [Webhook] Verified event:", evt.type);

  // Handle the organization.created event
  if (evt.type === "organization.created") {
    const { id, name, slug, created_by } = evt.data;

    console.log("🏢 [Webhook] Organization created:", {
      id,
      name,
      slug,
      created_by,
    });

    try {
      // Create tenant in our database
      const result = await TenantManager.createTenant(
        id,
        name,
        slug ||
          name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
      );
      console.log("✅ [Webhook] Tenant created successfully:", result);

      // Get the creator's user information from Clerk
      console.log("👤 [Webhook] Creating owner user in tenant schema...");

      if (!created_by) {
        throw new Error("No created_by user ID provided in webhook");
      }

      const clerk = await clerkClient();
      const user = await clerk.users.getUser(created_by);

      // Create the owner user in the tenant schema
      const tenantDb = getTenantDb(result.schemaName);
      const users = createUsersTable(result.schemaName);

      await tenantDb.insert(users).values({
        id: user.id,
        email: user.emailAddresses[0].emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.imageUrl,
        role: "owner",
        metadata: { onboardingComplete: false },
      });

      console.log("✅ [Webhook] Owner user created in tenant schema");

      return NextResponse.json({
        success: true,
        message: "Organization synced and owner created",
        tenant: result,
      });
    } catch (error) {
      console.error("❌ [Webhook] Failed to create tenant or user:", error);
      return NextResponse.json(
        { error: "Failed to sync organization" },
        { status: 500 }
      );
    }
  }

  console.log("ℹ️ [Webhook] Event processed:", evt.type);
  return NextResponse.json({ received: true });
}
```

### 2. Middleware for Tenant Resolution

```typescript
// src/middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

## User Interface

### 1. Onboarding Component

```tsx
// src/components/auth/onboarding/onboarding.tsx
"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Onboarding() {
  const { user } = useUser();
  const { userMemberships } = useOrganizationList({
    userMemberships: true
  });
  const router = useRouter();

  const handleCompleteOnboarding = async () => {
    if (!userMemberships?.data || userMemberships.data.length === 0) {
      return;
    }

    const org = userMemberships.data[0].organization;
    
    try {
      // Complete onboarding by updating the metadata
      const onboardingResponse = await fetch(`/api/tenants/${org.slug}/users/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!onboardingResponse.ok) {
        throw new Error("Error completing onboarding");
      }

      // Redirect to dashboard
      router.push(`/${org.slug}/dashboard`);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      alert("Error completing onboarding. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>¡Bienvenido, {user?.firstName || "Usuario"}!</CardTitle>
          <CardDescription>
            Tu organización ha sido creada exitosamente. ¡Estás listo para comenzar!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-center">
            <div className="text-sm text-muted-foreground">
              Tu cuenta está configurada y lista para usar.
            </div>
            
            <Button 
              onClick={handleCompleteOnboarding} 
              className="w-full"
            >
              Continuar al Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. Dashboard Page

```tsx
// src/app/[tenant]/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable, createProjectsTable } from "@/db/schemas/tenant";
import { eq, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage({
  params,
}: {
  params: { tenant: string };
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const tenant = await TenantManager.getTenantBySlug(params.tenant);
  if (!tenant) return null;

  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);

  // Get current user
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Get recent projects
  const recentProjects = await tenantDb
    .select()
    .from(projects)
    .where(eq(projects.createdBy, userId))
    .limit(5);

  // Count totals
  const [{ count: totalProjects }] = await tenantDb
    .select({ count: sql<number>`count(*)` })
    .from(projects);

  const [{ count: totalUsers }] = await tenantDb
    .select({ count: sql<number>`count(*)` })
    .from(users);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Bienvenido, {currentUser?.firstName || "Usuario"}
        </h2>
        <p className="text-muted-foreground">
          Tu rol: <span className="capitalize">{currentUser?.role}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Proyectos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tus Proyectos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentProjects.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Miembros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## API Routes

### 1. Tenant User Management

```typescript
// src/app/api/tenants/[slug]/users/onboarding/route.ts
import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable } from "@/db/schemas/tenant";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const tenant = await TenantManager.getTenantBySlug(params.slug);
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantDb = getTenantDb(tenant.schemaName);
    const users = createUsersTable(tenant.schemaName);

    // Update user metadata to mark onboarding as complete
    await tenantDb
      .update(users)
      .set({
        metadata: { onboardingComplete: true },
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Error al completar onboarding" },
      { status: 500 }
    );
  }
}
```

## Best Practices

### 1. Schema Change Management

When adding new fields to tenant schemas:

```bash
# 1. Modify schema files in src/db/schemas/tenant/
# 2. Generate migration
bun run db:generate:tenant

# 3. Update migration file to use $TENANT_SCHEMA$ placeholder
# Edit the generated .sql file:
# Before: ALTER TABLE "tenant"."users" ADD COLUMN "phone" varchar(50);
# After:  ALTER TABLE "$TENANT_SCHEMA$"."users" ADD COLUMN "phone" varchar(50);

# 4. Apply to all existing tenants
bun run db:migrate:tenants

# 5. New tenants will automatically get the latest schema
```

### 2. Performance Considerations

- **Connection Pooling**: Limit tenant connections (max 5 per tenant)
- **Query Optimization**: Use indexes on frequently queried columns
- **Caching**: Implement Redis caching for tenant metadata
- **Monitoring**: Track query performance per tenant

### 3. Security Best Practices

- Always validate tenant access in middleware
- Use Row Level Security (RLS) as additional layer
- Implement rate limiting per tenant
- Regular security audits of cross-tenant queries
- Never expose internal schema names to clients

### 4. Error Handling

```typescript
// Centralized error handling for tenant operations
export async function withTenantErrorHandling<T>(
  operation: () => Promise<T>,
  tenantId: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Tenant ${tenantId} operation failed:`, error);
    
    // Log to monitoring service
    await logTenantError(tenantId, error);
    
    // Return user-friendly error
    throw new Error("An error occurred processing your request");
  }
}
```

## Deployment & Production

### 1. Environment Setup

```bash
# Production environment variables
DATABASE_URL=postgresql://user:password@prod-host:5432/saas_prod
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
REDIS_URL=redis://prod-redis:6379
```

### 2. Migration Strategy

```bash
# Production migration workflow
1. Test migrations in staging environment
2. Backup production database
3. Apply public schema migrations first
4. Apply tenant schema migrations (with rollback plan)
5. Verify data integrity
6. Monitor performance post-migration
```

### 3. Monitoring

```typescript
// Health check endpoint
// src/app/api/health/route.ts
export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);
    
    // Check tenant connections
    const activeTenants = await TenantManager.getAllTenants();
    const healthyTenants = [];
    
    for (const tenant of activeTenants.slice(0, 5)) {
      try {
        const tenantDb = getTenantDb(tenant.schemaName);
        await tenantDb.execute(sql`SELECT 1`);
        healthyTenants.push(tenant.slug);
      } catch (error) {
        console.error(`Tenant ${tenant.slug} health check failed:`, error);
      }
    }
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tenantsChecked: healthyTenants.length,
      totalTenants: activeTenants.length,
    });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message,
    }, { status: 500 });
  }
}
```

## Troubleshooting

### Common Issues

1. **Migration Failures**
   ```bash
   # Check migration status
   SELECT * FROM tenant_schema._migrations;
   
   # Reset failed migration
   DELETE FROM tenant_schema._migrations WHERE filename = 'failed_migration.sql';
   ```

2. **Connection Pool Exhaustion**
   - Monitor active connections per tenant
   - Implement connection cleanup on idle timeout
   - Use connection limits in production

3. **Schema Sync Issues**
   - Always test migrations in development first
   - Use transactions for multi-step migrations
   - Keep migration rollback scripts

4. **Performance Issues**
   - Add indexes for frequently queried columns
   - Monitor slow queries per tenant
   - Implement query timeouts

### Development Tips

```bash
# Reset development database
bun run db:reset

# View migration status for all tenants
bun run src/scripts/migration-status.ts

# Test single tenant migration
bun run src/scripts/migrate-single-tenant.ts tenant_test

# Generate sample data for testing
bun run src/scripts/seed-data.ts
```

## Next Steps

1. **Set up monitoring and alerting**
2. **Implement automated backups**
3. **Add rate limiting per tenant**
4. **Set up CI/CD pipeline for migrations**
5. **Implement tenant-specific customizations**
6. **Add billing integration**
7. **Performance optimization**
8. **Security audit**

This guide provides a complete foundation for building production-ready multi-tenant SaaS applications with PostgreSQL schema isolation, automated migrations, and robust error handling.