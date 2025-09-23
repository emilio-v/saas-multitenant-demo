# Migration Workflow Guide

This document provides the complete step-by-step process for managing database schema changes in the multi-tenant application.

## Table of Contents

1. [Overview](#overview)
2. [Migration Commands Reference](#migration-commands-reference)
3. [Schema Change Workflow](#schema-change-workflow)
4. [Testing Schema Changes](#testing-schema-changes)
5. [Production Migration Strategy](#production-migration-strategy)
6. [Troubleshooting](#troubleshooting)

## Overview

The application uses a sophisticated migration system with two separate schema types:
- **Public Schema**: Contains tenant metadata (tenants table)
- **Tenant Schemas**: Contains tenant-specific data (users, projects, etc.)

Each tenant gets isolated data in its own PostgreSQL schema (`tenant_xxx`) with migration tracking.

## Migration Commands Reference

### Generation Commands (Create Migration Files)
```bash
# Generate public schema migrations
bun run db:generate:public

# Generate tenant schema migrations  
bun run db:generate:tenant

# Generate both (recommended for safety)
bun run db:generate:all
```

### Application Commands (Apply Migrations to Database)
```bash
# Apply public schema migrations
bun run db:migrate:public

# Apply tenant schema migrations to all existing tenants
bun run db:migrate:tenants

# Apply all migrations (public first, then tenants)
bun run db:migrate:all
```

### Utility Commands
```bash
# Reset database completely (⚠️ DESTRUCTIVE)
bun run db:reset

# Empty database but keep structure
bun run db:empty
```

## Schema Change Workflow

### Step 1: Modify Schema Definition

Edit the relevant schema file:

**For tenant-specific changes** (users, projects):
```typescript
// src/db/schemas/tenant/users.ts
const usersTableSchema = {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  // ... existing fields
  newField: varchar("new_field", { length: 100 }), // 👈 Add new field
};
```

**For public schema changes** (tenants table):
```typescript
// src/db/schemas/public/tenants.ts
export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 255 }).primaryKey(),
  // ... existing fields  
  newField: varchar("new_field", { length: 100 }), // 👈 Add new field
});
```

### Step 2: Generate Migration

Generate the migration file based on schema changes:

```bash
# For tenant schema changes
bun run db:generate:tenant

# For public schema changes
bun run db:generate:public
```

**Expected Output:**
```
Reading config file 'drizzle.config.tenant.ts'
2 tables
users 14 columns 0 indexes 0 fks  // Note: column count increased
projects 9 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ src/db/migrations/tenant/0002_xxx.sql 🚀
```

### Step 3: Fix Migration Placeholder (Tenant Migrations Only)

**CRITICAL**: For tenant migrations, you must manually replace the schema reference:

```bash
# Check the generated migration file
cat src/db/migrations/tenant/0002_xxx.sql
```

**Before (Generated):**
```sql
ALTER TABLE "tenant"."users" ADD COLUMN "new_field" varchar(100);
```

**After (Fixed):**
```sql
ALTER TABLE "$TENANT_SCHEMA$"."users" ADD COLUMN "new_field" varchar(100);
```

**Make the change:**
```typescript
// Replace "tenant" with "$TENANT_SCHEMA$"
ALTER TABLE "$TENANT_SCHEMA$"."users" ADD COLUMN "new_field" varchar(100);
```

> ⚠️ **Important**: Always use `$TENANT_SCHEMA$` (with dollar signs) as the placeholder!

### Step 4: Apply Migrations

**For Development:**
```bash
# Apply to existing tenants
bun run db:migrate:tenants
```

**For Production:**
```bash
# Test in staging first!
# Then apply in production with monitoring
bun run db:migrate:tenants
```

### Step 5: Verify Migration Success

**Check Migration Applied:**
```bash
# Expected output shows successful application
🔄 Migrating tenant: Acme (tenant_acme)
  📝 Applying 0002_xxx.sql...
  ✅ Acme migration completed
🎉 All tenant migrations completed successfully!
```

**Verify in Database:**
```sql
-- Connect to database
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant

-- Check if column exists
\d tenant_acme.users

-- Should show the new column in the table structure
```

## Testing Schema Changes

### Complete Test Workflow

1. **Create Test Schema Change:**
```typescript
// Add test field to src/db/schemas/tenant/users.ts
timezone: varchar("timezone", { length: 50 }),
```

2. **Generate and Fix Migration:**
```bash
bun run db:generate:tenant
# Edit generated file to use $TENANT_SCHEMA$
```

3. **Test on Development:**
```bash
# Apply to existing tenants
bun run db:migrate:tenants
```

4. **Test New Tenant Creation:**
```bash
# Start app and create new organization
bun run dev
# New tenants should automatically get latest schema
```

5. **Verify Both Scenarios:**
- ✅ Existing tenants receive the new column
- ✅ New tenants are created with the new column

## Production Migration Strategy

### Pre-Migration Checklist

- [ ] **Backup Database**: Always backup before migrations
- [ ] **Test in Staging**: Apply migrations to staging environment first
- [ ] **Monitor Resources**: Check database load during migration
- [ ] **Rollback Plan**: Have rollback strategy ready
- [ ] **Maintenance Window**: Schedule during low-traffic hours

### Production Migration Process

1. **Backup Database:**
```bash
# Create backup
docker exec saas_multitenant_demo pg_dump -U user saas_multitenant > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Apply Public Migrations First:**
```bash
bun run db:migrate:public
```

3. **Apply Tenant Migrations:**
```bash
# Monitor output carefully
bun run db:migrate:tenants
```

4. **Verify Success:**
```bash
# Check all tenants migrated successfully
# Verify application functionality
# Monitor error logs
```

### Rollback Strategy

If migration fails:

```sql
-- Connect to database
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant

-- For each affected tenant, remove failed migration record
DELETE FROM tenant_xxx._migrations WHERE filename = 'failed_migration.sql';

-- Manually revert schema changes if needed
ALTER TABLE tenant_xxx.users DROP COLUMN problematic_column;
```

## Troubleshooting

### Common Issues

**1. "No schema changes, nothing to migrate 😴"**
- **Cause**: Schema definition already matches migration files
- **Solution**: This is normal if no changes were made

**2. "schema TENANT_SCHEMA does not exist"**
- **Cause**: Forgot to replace `"tenant"` with `$TENANT_SCHEMA$` in migration file
- **Solution**: Edit migration file to use correct placeholder

**3. "relation already exists"**
- **Cause**: Migration was partially applied
- **Solution**: Check `_migrations` table and remove failed migration record

**4. "column already exists"**
- **Cause**: Migration tracking out of sync
- **Solution**: Mark migration as applied in `_migrations` table

### Debug Commands

```bash
# Check migration status for specific tenant
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant -c "SELECT * FROM tenant_acme._migrations;"

# Check table structure
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant -c "\d tenant_acme.users"

# List all tenant schemas
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant -c "\dn"
```

### Migration File Template

When creating manual migrations, use this template:

```sql
-- src/db/migrations/tenant/XXXX_description.sql
-- Description: Add new_field column to users table
-- Date: 2024-01-XX
-- Author: Developer Name

-- Add new column
ALTER TABLE "$TENANT_SCHEMA$"."users" ADD COLUMN "new_field" varchar(100);

-- Add index if needed (optional)
-- CREATE INDEX idx_users_new_field ON "$TENANT_SCHEMA$"."users"("new_field");

-- Update existing records if needed (optional)
-- UPDATE "$TENANT_SCHEMA$"."users" SET new_field = 'default_value' WHERE new_field IS NULL;
```

## Best Practices

### Schema Design
- ✅ Always make new columns nullable or provide defaults
- ✅ Use appropriate data types and lengths
- ✅ Consider adding indexes for frequently queried columns
- ✅ Follow consistent naming conventions

### Migration Safety
- ✅ Test migrations in development first
- ✅ Create database backups before production migrations
- ✅ Apply migrations during low-traffic periods
- ✅ Monitor application after migrations
- ✅ Have rollback procedures ready

### Development Workflow
- ✅ Always generate migrations rather than manual SQL
- ✅ Review generated migration files before applying
- ✅ Fix schema placeholders for tenant migrations
- ✅ Commit migration files with code changes
- ✅ Document significant schema changes

---

## Quick Reference

### New Developer Setup
```bash
# 1. Setup database
docker run --name saas_multitenant_demo -e POSTGRES_PASSWORD=password -e POSTGRES_USER=user -e POSTGRES_DB=saas_multitenant -p 5432:5432 -d postgres:15-alpine

# 2. Apply all migrations
bun run db:migrate:all

# 3. Start development
bun run dev
```

### Adding New Field Workflow
```bash
# 1. Edit schema file (add new field)
# 2. Generate migration
bun run db:generate:tenant

# 3. Fix placeholder in generated file
# Replace "tenant" with "$TENANT_SCHEMA$"

# 4. Apply to existing tenants
bun run db:migrate:tenants

# 5. Test new tenant creation
# New tenants automatically get latest schema
```

### Emergency Reset (Development Only)
```bash
# ⚠️ DESTRUCTIVE - Only use in development
bun run db:reset
bun run db:migrate:all
```

This workflow ensures consistent, safe, and tracked database schema changes across all tenants in the multi-tenant application.