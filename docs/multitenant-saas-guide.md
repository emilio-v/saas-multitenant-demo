# Multi-Tenant SaaS with Schema Isolation - Complete Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Initial Setup](#initial-setup)
4. [Database Configuration](#database-configuration)
5. [Migration Strategy](#migration-strategy)
6. [Authentication with Clerk](#authentication-with-clerk)
7. [Implementation Steps](#implementation-steps)
8. [Managing Schema Changes](#managing-schema-changes)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide covers building a multi-tenant SaaS application using:
- **Bun** + **Next.js 15** + **TypeScript**
- **PostgreSQL** with schema-per-tenant isolation
- **Drizzle ORM** for type-safe database operations
- **Clerk** for authentication
- **Server Components** and **App Router**

### Why Schema-per-Tenant?

Schema-per-tenant provides the ideal balance between:
- **Data isolation**: Each tenant has its own PostgreSQL schema
- **Resource efficiency**: Shared database instance
- **Flexibility**: Custom schema modifications per tenant
- **Performance**: Optimized queries with proper indexing
- **Compliance**: Easier to meet regulatory requirements

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   subdomain1    │     │   subdomain2    │     │   subdomain3    │
│  .myapp.com     │     │  .myapp.com     │     │  .myapp.com     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   Next.js Application   │
                    │  - Middleware (Tenant)  │
                    │  - Clerk Auth           │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   PostgreSQL Database   │
                    ├─────────────────────────┤
                    │  public schema          │
                    │  - tenants table        │
                    │  - shared data          │
                    ├─────────────────────────┤
                    │  tenant_company1        │
                    │  - users, projects...   │
                    ├─────────────────────────┤
                    │  tenant_company2        │
                    │  - users, projects...   │
                    └─────────────────────────┘
```

## Initial Setup

### 1. Project Structure

```
project-root/
├── drizzle.config.public.ts      # Public schema config
├── drizzle.config.tenant.ts      # Tenant schema config
├── src/
│   ├── app/
│   │   ├── (public)/            # Public routes
│   │   ├── [tenant]/            # Tenant-specific routes
│   │   └── api/
│   ├── db/
│   │   ├── config/              # Database configuration
│   │   ├── schemas/
│   │   │   ├── public/          # Public schema definitions
│   │   │   └── tenant/          # Tenant schema definitions
│   │   └── migrations/
│   │       ├── public/          # Public schema migrations
│   │       └── tenant/          # Tenant schema migrations
│   ├── lib/
│   │   ├── clerk/               # Clerk integration
│   │   └── tenant/              # Tenant utilities
│   └── scripts/                 # Migration & utility scripts
```

### 2. Dependencies

```json
{
  "dependencies": {
    "@clerk/nextjs": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "drizzle-kit": "latest",
    "typescript": "latest",
    "dotenv": "latest",
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "p-limit": "^5.0.0"
  }
}
```

### 3. Environment Variables

```bash
# .env.local
DATABASE_URL=postgresql://user:password@localhost:5432/saas_db
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
```

## Database Configuration

### 1. Drizzle Configuration Files

```typescript
// drizzle.config.public.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schemas/public/*.ts',
  out: './src/db/migrations/public',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  schemaFilter: ['public'],
} satisfies Config;
```

```typescript
// drizzle.config.tenant.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schemas/tenant/*.ts',
  out: './src/db/migrations/tenant',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### 2. Database Connection Manager

```typescript
// src/db/config/database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as publicSchema from '../schemas/public';
import * as tenantSchema from '../schemas/tenant';

// Main connection pool for public schema
const mainSql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const publicDb = drizzle(mainSql, { 
  schema: publicSchema,
  logger: process.env.NODE_ENV === 'development',
});

// Tenant connection cache
const tenantConnections = new Map<string, ReturnType<typeof postgres>>();
const tenantDbs = new Map<string, ReturnType<typeof drizzle>>();

export function getTenantDb(schemaName: string) {
  if (!tenantDbs.has(schemaName)) {
    const sql = postgres(process.env.DATABASE_URL!, {
      max: 5,
      idle_timeout: 60,
      connection: {
        search_path: schemaName,
      },
    });
    
    const db = drizzle(sql, { 
      schema: tenantSchema,
      logger: process.env.NODE_ENV === 'development',
    });
    
    tenantConnections.set(schemaName, sql);
    tenantDbs.set(schemaName, db);
  }
  
  return tenantDbs.get(schemaName)!;
}

// Cleanup function
export async function closeTenantConnection(schemaName: string) {
  const sql = tenantConnections.get(schemaName);
  if (sql) {
    await sql.end();
    tenantConnections.delete(schemaName);
    tenantDbs.delete(schemaName);
  }
}
```

## Migration Strategy

### 1. Schema Definitions

```typescript
// src/db/schemas/public/tenants.ts
import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'inactive', 'suspended']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemaName: text('schema_name').notNull().unique(),
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  settings: jsonb('settings').default({}),
  status: tenantStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// src/db/schemas/tenant/users.ts
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull().default('member'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// src/db/schemas/tenant/projects.ts
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 2. Migration Scripts

```typescript
// src/scripts/migrate-public.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import chalk from 'chalk';

async function migratePublic() {
  console.log(chalk.blue('🔄 Starting public schema migration...'));
  
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);
  
  try {
    await migrate(db, {
      migrationsFolder: './src/db/migrations/public',
      migrationsTable: 'drizzle_migrations',
    });
    
    console.log(chalk.green('✅ Public schema migration completed!'));
  } catch (error) {
    console.error(chalk.red('❌ Public migration failed:'), error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migratePublic();
```

```typescript
// src/scripts/migrate-tenants.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { publicDb } from '@/db/config/database';
import { tenants } from '@/db/schemas/public/tenants';
import { eq } from 'drizzle-orm';
import chalk from 'chalk';
import ora from 'ora';
import pLimit from 'p-limit';

async function migrateTenant(schemaName: string, tenantName: string) {
  const spinner = ora(`Migrating ${tenantName}`).start();
  
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    connection: { search_path: schemaName },
  });
  
  const db = drizzle(sql);
  
  try {
    // Create schema if not exists
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`;
    
    // Run migrations
    await migrate(db, {
      migrationsFolder: './src/db/migrations/tenant',
      migrationsTable: 'drizzle_migrations',
    });
    
    spinner.succeed(`${tenantName} migrated successfully`);
  } catch (error) {
    spinner.fail(`${tenantName} migration failed`);
    throw error;
  } finally {
    await sql.end();
  }
}

async function migrateAllTenants() {
  console.log(chalk.blue('🔄 Starting tenant migrations...'));
  
  const activeTenants = await publicDb
    .select()
    .from(tenants)
    .where(eq(tenants.status, 'active'));
  
  if (activeTenants.length === 0) {
    console.log(chalk.yellow('⚠️  No active tenants found'));
    return;
  }
  
  // Limit concurrency
  const limit = pLimit(3);
  
  const migrationPromises = activeTenants.map(tenant =>
    limit(() => migrateTenant(tenant.schemaName, tenant.name))
  );
  
  await Promise.all(migrationPromises);
  
  console.log(chalk.green(`✅ All ${activeTenants.length} tenants migrated!`));
}

migrateAllTenants();
```

### 3. Package.json Scripts

```json
{
  "scripts": {
    "db:generate:public": "drizzle-kit generate:pg --config=drizzle.config.public.ts",
    "db:generate:tenant": "drizzle-kit generate:pg --config=drizzle.config.tenant.ts",
    "db:migrate:public": "bun run src/scripts/migrate-public.ts",
    "db:migrate:tenants": "bun run src/scripts/migrate-tenants.ts",
    "db:migrate:all": "bun run src/scripts/migrate-all.ts",
    "db:studio:public": "drizzle-kit studio --config=drizzle.config.public.ts"
  }
}
```

## Authentication with Clerk

### 1. Middleware Integration

```typescript
// src/middleware.ts
import { authMiddleware } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { publicDb } from '@/db/config/database';
import { tenants } from '@/db/schemas/public/tenants';
import { eq } from 'drizzle-orm';

export default authMiddleware({
  publicRoutes: ['/', '/sign-in(.*)', '/sign-up(.*)', '/api/webhooks(.*)'],
  
  async afterAuth(auth, req) {
    const hostname = req.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    // Handle main domain
    if (!subdomain || subdomain === 'www' || subdomain === 'localhost') {
      if (auth.userId && !req.nextUrl.pathname.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
      return NextResponse.next();
    }
    
    // Verify tenant exists
    const [tenant] = await publicDb
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .where(eq(tenants.status, 'active'));
    
    if (!tenant) {
      return NextResponse.redirect(new URL('https://app.yourdomain.com/404', req.url));
    }
    
    // Check authentication
    if (!auth.userId && !auth.isPublicRoute) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    
    // Verify user belongs to tenant
    if (auth.userId) {
      const userTenantId = auth.sessionClaims?.tenantId as string;
      
      if (!userTenantId || userTenantId !== tenant.id) {
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }
    
    // Add tenant headers
    const response = NextResponse.next();
    response.headers.set('x-tenant-id', tenant.id);
    response.headers.set('x-tenant-schema', tenant.schemaName);
    response.headers.set('x-tenant-subdomain', tenant.subdomain);
    
    return response;
  },
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
```

### 2. Clerk Webhook Handler

```typescript
// src/app/api/webhooks/clerk/route.ts
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { publicDb, getTenantDb } from '@/db/config/database';
import { tenants } from '@/db/schemas/public/tenants';
import { users } from '@/db/schemas/tenant/users';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;
  
  // Verify webhook
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');
  
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing headers', { status: 400 });
  }
  
  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  
  let evt: WebhookEvent;
  
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response('Webhook verification failed', { status: 400 });
  }
  
  switch (evt.type) {
    case 'user.created': {
      const tenantId = evt.data.public_metadata?.tenantId as string;
      
      if (tenantId) {
        const [tenant] = await publicDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        
        if (tenant) {
          const db = getTenantDb(tenant.schemaName);
          await db.insert(users).values({
            clerkId: evt.data.id,
            email: evt.data.email_addresses[0].email_address,
            name: `${evt.data.first_name} ${evt.data.last_name}`,
            role: evt.data.public_metadata?.role || 'member',
          });
        }
      }
      break;
    }
    
    case 'user.updated': {
      // Handle user updates
      break;
    }
    
    case 'user.deleted': {
      // Handle user deletion
      break;
    }
  }
  
  return new Response('Webhook processed', { status: 200 });
}
```

## Implementation Steps

### 1. Tenant Context Provider

```typescript
// src/lib/tenant/tenant-context.tsx
'use client';

import { createContext, useContext } from 'react';

interface TenantContextType {
  tenantId: string;
  schemaName: string;
  subdomain: string;
  settings?: Record<string, any>;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ 
  children, 
  tenant 
}: { 
  children: React.ReactNode;
  tenant: TenantContextType;
}) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
```

### 2. Tenant Layout

```typescript
// src/app/[tenant]/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';
import { headers } from 'next/headers';
import { TenantProvider } from '@/lib/tenant/tenant-context';
import { publicDb } from '@/db/config/database';
import { tenants } from '@/db/schemas/public/tenants';
import { eq } from 'drizzle-orm';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id')!;
  const schemaName = headersList.get('x-tenant-schema')!;
  const subdomain = headersList.get('x-tenant-subdomain')!;
  
  const [tenant] = await publicDb
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  
  return (
    <ClerkProvider>
      <TenantProvider 
        tenant={{
          tenantId,
          schemaName,
          subdomain,
          settings: tenant.settings as Record<string, any>,
        }}
      >
        {children}
      </TenantProvider>
    </ClerkProvider>
  );
}
```

### 3. Protected API Routes

```typescript
// src/app/api/[tenant]/projects/route.ts
import { auth } from '@clerk/nextjs';
import { NextRequest } from 'next/server';
import { getTenantDb } from '@/db/config/database';
import { projects } from '@/db/schemas/tenant/projects';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const schemaName = request.headers.get('x-tenant-schema')!;
  const db = getTenantDb(schemaName);
  
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));
  
  return Response.json(userProjects);
}

export async function POST(request: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const schemaName = request.headers.get('x-tenant-schema')!;
  const data = await request.json();
  
  const db = getTenantDb(schemaName);
  const [project] = await db
    .insert(projects)
    .values({
      ...data,
      userId,
    })
    .returning();
  
  return Response.json(project, { status: 201 });
}
```

## Managing Schema Changes

### 1. Adding New Columns/Tables

When you need to modify the schema (add columns, create tables), follow this workflow:

```bash
# 1. Modify schema files
# Edit files in src/db/schemas/tenant/

# 2. Generate new migration
bun run db:generate:tenant

# 3. Apply to all tenants
bun run db:migrate:tenants

# 4. Or test on single tenant first
bun run db:migrate:tenant tenant_test_company
```

### 2. Safe Migration Example

```typescript
// When adding NOT NULL columns to existing tables
// src/db/migrations/tenant/0004_add_required_field.sql

-- Step 1: Add column as nullable
ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;

-- Step 2: Populate existing rows
UPDATE users SET department = 'unassigned' WHERE department IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE users ALTER COLUMN department SET NOT NULL;
```

### 3. Handling Base + Custom Tables

```typescript
// src/db/schemas/public/categories-base.ts
export const categoriesBase = pgTable('categories_base', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
});

// src/db/schemas/tenant/categories-custom.ts
export const categoriesCustom = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseCategoryId: uuid('base_category_id'),
  customName: text('custom_name').notNull(),
  tenantSpecificField: text('tenant_specific_field'),
  isBaseOverride: boolean('is_base_override').default(false),
});

// Service to combine data
export class CategoryService {
  async getAllCategories(schemaName: string) {
    const baseCategories = await publicDb
      .select()
      .from(categoriesBase)
      .where(eq(categoriesBase.isActive, true));
    
    const db = getTenantDb(schemaName);
    const customCategories = await db
      .select()
      .from(categoriesCustom);
    
    // Merge logic here
    return mergeCategories(baseCategories, customCategories);
  }
}
```

## Best Practices

### 1. Connection Management

```typescript
// Use connection pooling efficiently
const MAX_TENANT_CONNECTIONS = 50;
const CONNECTION_TIMEOUT = 60000; // 1 minute

// Implement connection cleanup
setInterval(async () => {
  for (const [schemaName, lastUsed] of lastConnectionUse) {
    if (Date.now() - lastUsed > CONNECTION_TIMEOUT) {
      await closeTenantConnection(schemaName);
    }
  }
}, CONNECTION_TIMEOUT);
```

### 2. Security Considerations

- Always validate tenant access in middleware
- Use Row Level Security (RLS) as additional layer
- Implement rate limiting per tenant
- Regular security audits of cross-tenant queries

### 3. Performance Optimization

```typescript
// Create indexes for common queries
export const createIndexes = sql`
  CREATE INDEX idx_projects_user_id ON projects(user_id);
  CREATE INDEX idx_projects_status ON projects(status);
  CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
`;

// Use connection pooling wisely
const tenantDb = getTenantDb(schemaName);
// Reuse this connection for multiple queries in the same request
```

### 4. Monitoring and Logging

```typescript
// Track tenant metrics
export async function logTenantActivity(
  tenantId: string,
  action: string,
  metadata?: any
) {
  await publicDb.insert(tenantActivityLogs).values({
    tenantId,
    action,
    metadata,
    timestamp: new Date(),
  });
}
```

### 5. Backup Strategy

```typescript
// Backup individual tenant
async function backupTenant(schemaName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${schemaName}_${timestamp}.sql`;
  
  const command = `pg_dump ${process.env.DATABASE_URL} \
    --schema=${schemaName} \
    --file=./backups/${filename} \
    --verbose`;
  
  await exec(command);
  return filename;
}
```

## Troubleshooting

### Common Issues and Solutions

1. **Migration Failures**
   ```bash
   # Check migration status
   SELECT * FROM tenant_schema.drizzle_migrations;
   
   # Manually rollback if needed
   DELETE FROM tenant_schema.drizzle_migrations WHERE hash = 'failed_migration_hash';
   ```

2. **Connection Pool Exhaustion**
   - Implement connection limits per tenant
   - Use connection pooling with proper timeouts
   - Monitor active connections

3. **Schema Sync Issues**
   - Always run migrations in transaction
   - Implement migration validation before applying
   - Keep migration rollback scripts

4. **Performance Degradation**
   - Monitor query performance per tenant
   - Implement query timeouts
   - Use materialized views for complex queries

### Debugging Tools

```typescript
// Enable query logging in development
const db = drizzle(sql, { 
  logger: {
    logQuery(query, params) {
      console.log('Query:', query);
      console.log('Params:', params);
    },
  },
});
```

### Health Checks

```typescript
// API endpoint for tenant health
export async function GET(request: NextRequest) {
  const schemaName = request.headers.get('x-tenant-schema')!;
  
  try {
    const db = getTenantDb(schemaName);
    
    // Test query
    await db.execute(sql`SELECT 1`);
    
    // Check table existence
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ${schemaName}
    `);
    
    return Response.json({
      status: 'healthy',
      schema: schemaName,
      tables: tables.length,
    });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message,
    }, { status: 500 });
  }
}
```

## Conclusion

This architecture provides a robust foundation for multi-tenant SaaS applications with:
- Complete data isolation
- Scalable infrastructure
- Type-safe database operations
- Secure authentication
- Flexible schema management

Remember to always test migrations in development first and maintain regular backups of your production database.

### Next Steps

1. Set up monitoring and alerting
2. Implement automated backups
3. Add rate limiting per tenant
4. Set up CI/CD pipeline for migrations
5. Implement tenant-specific customizations
6. Add billing integration

For more information and updates, check the official documentation:
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Clerk Documentation](https://clerk.com/docs)
- [PostgreSQL Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)