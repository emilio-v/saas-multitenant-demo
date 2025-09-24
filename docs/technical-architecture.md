# Technical Architecture Documentation

## Overview

This document provides a comprehensive technical overview of the multi-tenant SaaS application, explaining the architecture, data flow, components, and technical decisions.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [Authentication & Authorization](#authentication--authorization)
4. [Migration System](#migration-system)
5. [Request Flow](#request-flow)
6. [Component Architecture](#component-architecture)
7. [API Design](#api-design)
8. [Security Implementation](#security-implementation)
9. [Performance Considerations](#performance-considerations)
10. [Known Issues & Technical Debt](#known-issues--technical-debt)
11. [Future Enhancements](#future-enhancements)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │   acme.app.com  │ │testcorp.app.com │ │  demo.app.com   │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │        Next.js App Router       │
                │  ┌──────────────────────────┐   │
                │  │     Clerk Middleware     │   │
                │  │  - Authentication        │   │
                │  │  - Tenant Resolution     │   │
                │  │  - Route Protection      │   │
                │  └──────────────────────────┘   │
                │  ┌──────────────────────────┐   │
                │  │    Application Layer     │   │
                │  │  - API Routes            │   │
                │  │  - Server Components     │   │
                │  │  - Client Components     │   │
                │  └──────────────────────────┘   │
                │  ┌──────────────────────────┐   │
                │  │    Database Layer        │   │
                │  │  - Drizzle ORM           │   │
                │  │  - Connection Pool       │   │
                │  │  - Migration System      │   │
                │  └──────────────────────────┘   │
                └────────────────┬────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │      PostgreSQL Database        │
                │  ┌──────────────────────────┐   │
                │  │      public schema       │   │
                │  │   - tenants table        │   │
                │  │   - shared metadata      │   │
                │  └──────────────────────────┘   │
                │  ┌──────────────────────────┐   │
                │  │     tenant_acme          │   │
                │  │   - users table          │   │
                │  │   - projects table       │   │
                │  │   - _migrations table    │   │
                │  └──────────────────────────┘   │
                │  ┌──────────────────────────┐   │
                │  │     tenant_testcorp      │   │
                │  │   - users table          │   │
                │  │   - projects table       │   │
                │  │   - _migrations table    │   │
                │  └──────────────────────────┘   │
                └─────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Bun | Latest | Fast JavaScript runtime |
| Framework | Next.js | 15.5.3 | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety and developer experience |
| Database | PostgreSQL | 15.x | Relational database with schema support |
| ORM | Drizzle | 0.44.5 | Type-safe database operations |
| Auth | Clerk | 6.32.0 | Authentication and user management |
| UI | Shadcn/ui | Latest | Component library |
| Styling | Tailwind CSS | 4.x | Utility-first CSS framework |
| Build | Turbopack | Built-in | Fast development and production builds |

## Database Design

### Schema-per-Tenant Architecture

The application implements a **schema-per-tenant** isolation strategy, providing complete data separation while maintaining resource efficiency.

#### Public Schema

```sql
-- public.tenants: Central tenant registry
CREATE TABLE public.tenants (
    id VARCHAR(255) PRIMARY KEY,           -- Clerk organization ID
    name VARCHAR(255) NOT NULL,            -- Display name
    slug VARCHAR(255) UNIQUE NOT NULL,     -- URL identifier
    schema_name VARCHAR(63) UNIQUE NOT NULL,-- PostgreSQL schema name
    is_active BOOLEAN DEFAULT true,        -- Status flag
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tenant Schema Template

Each tenant gets its own PostgreSQL schema with identical structure:

```sql
-- tenant_xxx.users: Tenant-specific users
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,           -- Clerk user ID
    email VARCHAR(255) UNIQUE NOT NULL,    -- User email
    first_name VARCHAR(255),               -- First name
    last_name VARCHAR(255),                -- Last name
    avatar_url VARCHAR(500),               -- Profile image
    phone VARCHAR(50),                     -- Phone number (recent addition)
    role VARCHAR(50) DEFAULT 'member',     -- Role in organization
    metadata JSONB DEFAULT '{}',           -- Flexible metadata storage
    is_active BOOLEAN DEFAULT true,        -- Account status
    last_seen_at TIMESTAMP,                -- Last activity
    joined_at TIMESTAMP DEFAULT NOW(),     -- When user joined org
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- tenant_xxx.projects: Tenant-specific projects
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,                 -- Auto-increment ID
    name VARCHAR(255) NOT NULL,            -- Project name
    slug VARCHAR(255) UNIQUE NOT NULL,     -- URL-safe identifier
    description TEXT,                      -- Optional description
    created_by VARCHAR(255) NOT NULL,      -- References users.id
    is_public BOOLEAN DEFAULT false,       -- Visibility flag
    status VARCHAR(50) DEFAULT 'active',   -- Project status
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- tenant_xxx._migrations: Migration tracking
CREATE TABLE _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL, -- Migration file name
    applied_at TIMESTAMP DEFAULT NOW()     -- When applied
);
```

### Database Connection Strategy

```typescript
// Connection architecture
┌─────────────────────────────────────┐
│          Connection Pool            │
├─────────────────────────────────────┤
│  Public DB (1 connection pool)     │
│  - Max: 10 connections             │
│  - Used for: tenant metadata       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│       Tenant Connections            │
├─────────────────────────────────────┤
│  Per-tenant pools (cached)         │
│  - Max: 5 connections per tenant   │
│  - search_path: tenant_xxx          │
│  - Auto-cleanup on idle             │
└─────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/db/config/database.ts
const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql);

// Tenant connection cache
const tenantConnections = new Map<string, ReturnType<typeof postgres>>();
const tenantDbs = new Map<string, ReturnType<typeof drizzle>>();

export function getTenantDb(schemaName: string) {
  if (!tenantDbs.has(schemaName)) {
    const tenantSql = postgres(process.env.DATABASE_URL!, {
      max: 5,
      idle_timeout: 60,
      connection: {
        search_path: schemaName, // Key: Sets default schema
      },
    });
    
    const tenantDb = drizzle(tenantSql);
    tenantConnections.set(schemaName, tenantSql);
    tenantDbs.set(schemaName, tenantDb);
  }
  
  return tenantDbs.get(schemaName)!;
}
```

### Database Provider Compatibility

The application is designed to work consistently across PostgreSQL providers through schema-aware operations:

**Supported Providers:**
- Docker PostgreSQL 12+
- Supabase (Managed PostgreSQL) 
- AWS RDS PostgreSQL
- Google Cloud SQL PostgreSQL
- Azure Database for PostgreSQL
- Any PostgreSQL instance with schema support

**Cross-Provider Compatibility Features:**
- Schema-aware table factory functions with explicit schema parameters
- Migration placeholders (`$TENANT_SCHEMA$`) for provider-agnostic SQL
- Connection pooling optimized for different provider characteristics
- Explicit schema references in all database operations

**Key Implementation Pattern:**
```typescript
// Schema-aware table creation ensures compatibility
const users = createUsersTable(tenant.schemaName); // ✅ Provider agnostic
const users = createUsersTable(); // ❌ May not work on all providers
```

## Authentication & Authorization

### Clerk Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Clerk Authentication Flow                 │
└─────────────────────────────────────────────────────────────┘

User Registration:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Sign Up │ => │Create Org│ => │ Webhook  │ => │ Redirect │
│   Page   │    │   Flow   │    │ Handler  │    │Dashboard │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                      │                │
                      ▼                ▼
              ┌──────────────┐  ┌──────────────┐
              │ Clerk Stores │  │  Our System  │
              │ - User data  │  │ - Creates    │
              │ - Org data   │  │   tenant     │
              │ - Session    │  │ - Creates    │
              │              │  │   user       │
              └──────────────┘  └──────────────┘
```

### Role-Based Access Control

```typescript
// src/lib/permissions.ts
export const rolePermissions = {
  owner: [
    "organization:manage",
    "users:manage", 
    "projects:create",
    "projects:edit:all",
    "projects:delete:all",
    "projects:view:all",
  ],
  admin: [
    "users:manage",
    "projects:create", 
    "projects:edit:all",
    "projects:delete:all", 
    "projects:view:all",
  ],
  member: [
    "projects:create",
    "projects:edit:own",
    "projects:delete:own",
    "projects:view:public",
    "projects:view:own",
  ],
  viewer: ["projects:view:public"],
};
```

### Webhook Integration

The application uses Clerk webhooks for automatic tenant and user provisioning:

```typescript
// src/app/api/webhooks/clerk/route.ts
Key Webhook Events:
1. organization.created -> Creates tenant + owner user
2. user.created -> Adds user to tenant (if invited)
3. organization.updated -> Updates tenant metadata

Webhook Security:
- HMAC signature verification using svix
- Environment variable validation
- Proper error handling and logging
```

## Migration System

### Advanced Migration Architecture

The application implements a sophisticated migration system with tracking and rollback capabilities:

```
Migration System Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Migration Components                      │
├─────────────────────────────────────────────────────────────┤
│  1. Schema Definitions (DRY Principle)                     │
│     - Shared schema objects                                 │
│     - Static exports for Drizzle Kit                       │
│     - Factory functions for runtime                        │
│                                                             │
│  2. Migration Generation                                    │
│     - drizzle-kit generate (separate configs)              │
│     - Placeholder replacement system                       │
│                                                             │
│  3. Migration Execution                                     │
│     - TenantManager (new tenants)                         │
│     - migrate-tenants script (existing tenants)           │
│     - Tracking with _migrations table                      │
│                                                             │
│  4. Migration Tracking                                      │
│     - Prevents duplicate applications                       │
│     - Rollback capability                                   │
│     - Historical record                                     │
└─────────────────────────────────────────────────────────────┘
```

### Migration Flow

```typescript
// Migration workflow for schema changes
1. Developer modifies schema definition
   └── src/db/schemas/tenant/users.ts

2. Generate migration file
   └── bun run db:generate:tenant
   └── Creates: src/db/migrations/tenant/0001_xxx.sql

3. Manual placeholder replacement (required)
   └── Before: ALTER TABLE "tenant"."users" ADD COLUMN "phone" varchar(50);
   └── After:  ALTER TABLE "$TENANT_SCHEMA$"."users" ADD COLUMN "phone" varchar(50);

4. Apply to existing tenants
   └── bun run db:migrate:tenants
   └── Automatically replaces $TENANT_SCHEMA$ with actual schema names

5. New tenants get latest schema automatically
   └── TenantManager.createTenant() applies all migrations
```

### DRY Principle Implementation

```typescript
// src/db/schemas/tenant/users.ts
// Schema definition once, used everywhere
const usersTableSchema = {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  // ... other fields
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

## Request Flow

### Tenant Resolution Flow

```
1. Request arrives: https://localhost:3000/acme/dashboard
                              │
2. Clerk Middleware (middleware.ts)
   ├── Authenticates user
   └── Proceeds to next handler
                              │
3. Dynamic Route Handler ([tenant]/layout.tsx)
   ├── Extracts tenant from path: "acme"
   ├── Validates tenant exists in public.tenants
   ├── Checks user belongs to tenant org
   └── Sets up tenant context
                              │
4. Server Component (dashboard/page.tsx)  
   ├── Gets tenant from path params
   ├── Gets tenant database connection
   ├── Queries tenant-specific data
   └── Renders with tenant context
                              │
4. Client receives tenant-specific page
```

### Database Query Flow

```typescript
// Example: Dashboard data fetching
async function DashboardPage({ params }: { params: { tenant: string } }) {
  // 1. Get tenant metadata from public schema
  const tenant = await TenantManager.getTenantBySlug(params.tenant);
  
  // 2. Get tenant-specific database connection
  const tenantDb = getTenantDb(tenant.schemaName);
  
  // 3. Create schema-aware table references for tenant
  const users = createUsersTable(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);
  
  // 4. Query tenant-specific data (isolated)
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId));
    
  // 5. Return tenant-specific view
  return <Dashboard user={currentUser} />;
}
```

## Component Architecture

### Component Organization

```
src/components/
├── auth/
│   └── onboarding/
│       ├── onboarding.tsx        # Main onboarding component
│       └── index.ts              # Barrel export
└── ui/                           # Shadcn/ui components
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    └── label.tsx
```

### Server vs Client Components

**Server Components (Default):**
- `src/app/[tenant]/dashboard/page.tsx` - Data fetching at server level
- `src/app/auth/onboarding/page.tsx` - Authentication checks server-side
- All layout components for SEO and performance

**Client Components (Explicit):**
- `src/components/auth/onboarding/onboarding.tsx` - Interactive forms
- Any component with event handlers or state

### Component Data Flow

```typescript
// Server Component (RSC)
┌─────────────────────────────────────┐
│  Dashboard Page (Server)            │
│  ├── Fetch tenant data            │
│  ├── Validate permissions          │
│  ├── Query database                │ 
│  └── Pass data to client           │
└─────────────────────────────────────┘
                  │
                  ▼ (serialized props)
┌─────────────────────────────────────┐
│  Interactive Components (Client)   │
│  ├── Handle user interactions      │
│  ├── Form submissions              │
│  ├── API calls                     │
│  └── State management              │
└─────────────────────────────────────┘
```

## API Design

### API Route Structure

```
src/app/api/
├── tenants/
│   └── [slug]/
│       └── users/
│           └── onboarding/
│               └── route.ts      # Complete user onboarding
└── webhooks/
    └── clerk/
        └── route.ts              # Handle Clerk events
```

### API Security Pattern

```typescript
// Standard API route security pattern
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  // 1. Authentication check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Tenant validation
  const tenant = await TenantManager.getTenantBySlug(params.slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // 3. Permission check (if needed)
  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId));
    
  if (!hasPermission(currentUser?.role, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Execute operation
  // ... business logic

  // 5. Return response
  return NextResponse.json({ success: true });
}
```

## Security Implementation

### Current Security Measures

**✅ Implemented:**
- Clerk authentication with HMAC webhook verification
- Schema-per-tenant data isolation
- Role-based access control
- Input validation in API routes
- Secure headers and CSRF protection

**⚠️ Security Issues Found:**

1. **SQL Injection Vulnerability (Critical)**
```typescript
// VULNERABLE CODE in src/db/config/tenant-manager.ts:92
await tenantDb.execute(`
  INSERT INTO "_migrations" (filename) VALUES ('${migrationFile}')
`);

// SHOULD BE:
await tenantDb.execute(sql`
  INSERT INTO "_migrations" (filename) VALUES (${migrationFile})
`);
```

2. **Missing Rate Limiting**
- No protection against brute force attacks
- API routes lack throttling

3. **Environment Variable Validation**
- Missing validation for required env vars at startup

### Security Recommendations

```typescript
// 1. Add environment validation
const requiredEnvVars = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY', 
  'CLERK_WEBHOOK_SECRET',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// 2. Add rate limiting middleware
import { rateLimit } from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// 3. Add audit logging
async function logTenantActivity(tenantId: string, action: string, userId: string) {
  await db.insert(auditLogs).values({
    tenantId,
    userId,
    action,
    timestamp: new Date(),
    ip: getClientIP()
  });
}
```

## Performance Considerations

### Current Performance Profile

**✅ Performance Strengths:**
- Server components for initial data loading
- Connection pooling with proper limits
- Turbopack for fast development builds
- Efficient database queries with Drizzle ORM

**🔄 Performance Issues:**

1. **Connection Pool Management**
```typescript
// Issue: Connections may not be cleaned up
// Location: src/db/config/database.ts

// Solution: Add cleanup mechanism
const connectionCleanup = setInterval(() => {
  for (const [schemaName, lastUsed] of lastConnectionUse) {
    if (Date.now() - lastUsed > IDLE_TIMEOUT) {
      closeTenantConnection(schemaName);
    }
  }
}, CLEANUP_INTERVAL);
```

2. **N+1 Query Problems**
```typescript
// Issue: Dashboard loads user and projects separately
// Could be optimized with JOIN queries or parallel fetching

// Current:
const user = await tenantDb.select().from(users)...;
const projects = await tenantDb.select().from(projects)...;

// Better:
const [user, projects] = await Promise.all([
  tenantDb.select().from(users)...,
  tenantDb.select().from(projects)...
]);
```

### Performance Monitoring

```typescript
// Add performance monitoring
export async function withPerformanceTracking<T>(
  operation: string,
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation: ${operation} took ${duration}ms for tenant ${tenantId}`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`Failed operation: ${operation} failed after ${duration}ms for tenant ${tenantId}`, error);
    throw error;
  }
}
```

## Known Issues & Technical Debt

### Critical Issues (Must Fix)

1. **SQL Injection Vulnerability** 
   - **File**: `src/db/config/tenant-manager.ts:92`
   - **Risk**: High
   - **Fix**: Use parameterized queries

2. **Missing Error Pages**
   - **Missing**: `404.tsx`, `500.tsx`, `error.tsx`
   - **Impact**: Poor user experience on errors

3. **Incomplete Project Features**
   - **Missing**: Individual project detail pages
   - **Route Exists**: `src/app/[tenant]/projects/[slug]/`
   - **Status**: Route defined but no implementation

### Medium Priority Issues

1. **Type Safety Improvements**
   - Replace `any` types in database query results
   - Add proper TypeScript interfaces for API responses

2. **Connection Management**
   - Implement proper connection cleanup
   - Add connection health checks
   - Monitor connection pool usage

3. **Error Handling**
   - Add comprehensive error boundaries
   - Implement structured logging
   - Add proper validation feedback

### Low Priority Technical Debt

1. **Code Organization**
   - Consolidate duplicate Drizzle configurations
   - Extract common utility functions
   - Add comprehensive JSDoc comments

2. **Development Experience**
   - Add database seeding scripts
   - Create development fixtures
   - Implement comprehensive testing

## Future Enhancements

### Short Term (Next Sprint)

1. **Complete Missing Features**
   - Individual project detail pages
   - User management interface for admins
   - Tenant settings dashboard

2. **Security Hardening**
   - Fix SQL injection vulnerability
   - Add rate limiting
   - Implement audit logging

3. **Error Handling**
   - Custom error pages
   - Loading states
   - Better validation feedback

### Medium Term (Next Quarter)

1. **Performance Optimization**
   - Implement caching strategy (Redis)
   - Database query optimization
   - Connection pool monitoring

2. **Advanced Features**
   - Real-time notifications
   - File upload system
   - Advanced search functionality

3. **Developer Experience**
   - Comprehensive testing suite
   - API documentation
   - Development tooling

### Long Term (6+ Months)

1. **Scalability**
   - Database sharding strategy
   - Microservices architecture consideration
   - CDN integration

2. **Enterprise Features**
   - SSO integration
   - Advanced analytics
   - Compliance features (GDPR, SOC2)

3. **Platform Features**
   - Public API for integrations
   - Webhook system for tenants
   - Multi-region deployment

---

## Conclusion

The application demonstrates a solid understanding of multi-tenant architecture with good separation of concerns and security practices. While there are some critical security issues that need immediate attention, the overall architecture is sound and production-ready for core functionality.

**Key Strengths:**
- Clean architecture with proper separation
- Type-safe database operations
- Comprehensive migration system
- Good security foundations

**Priority Fixes:**
1. SQL injection vulnerability (Critical)
2. Complete missing features (High)
3. Performance optimizations (Medium)

The codebase provides a strong foundation for building a scalable multi-tenant SaaS application with room for the identified enhancements.