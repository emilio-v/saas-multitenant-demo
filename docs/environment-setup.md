# Environment Setup Guide

This document provides detailed instructions for setting up the development environment, including Clerk authentication and PostgreSQL database configuration.

## Table of Contents

1. [Clerk Configuration](#clerk-configuration)
2. [Database Setup](#database-setup)
3. [Environment Variables](#environment-variables)
4. [Verification Steps](#verification-steps)

## Clerk Configuration

Based on the current Clerk dashboard configuration, here are the exact settings used in this application:

### Organization Management Settings

**Default Roles:**
```
✅ Default role for members: Member
✅ Creator's initial role: Owner
```

**Membership Limits:**
```
✅ Limited membership: 5 users per organization
✅ Allow new members to delete organizations: Enabled
```

**Organization Creation:**
```
✅ Allow new users to create organizations: Enabled
✅ Members can create a limited number of organizations: 1
```

### Roles & Permissions

The application uses a 4-tier role system:

| Role | Key | Permissions |
|------|-----|-------------|
| **Owner** | `org:owner` | • Manage organization<br>• Delete organization<br>• Manage all users<br>• Full project access |
| **Admin** | `org:admin` | • Manage organization<br>• Delete organization<br>• Read members/billing |
| **Member** | `org:member` | • Read members<br>• Read billing<br>• Standard access |
| **Viewer** | `org:viewer` | • Read members<br>• Read domains<br>• View-only access |

### Clerk Dashboard Settings Applied

1. **Organizations**: Enabled with custom roles
2. **Default membership limit**: 5 users per organization
3. **Organization deletion**: Allowed by new members
4. **Multi-organization limit**: 1 organization per user
5. **Verified domains**: Disabled (can be enabled later)
6. **Personal accounts**: Enabled

## Database Setup

### PostgreSQL with Docker

The application uses PostgreSQL 15 with Alpine Linux for optimal performance:

```bash
# Start PostgreSQL container
docker run --name saas_multitenant_demo \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=user \
  -e POSTGRES_DB=saas_multitenant \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### Docker Container Details

| Setting | Value | Description |
|---------|-------|-------------|
| **Container Name** | `saas_multitenant_demo` | Easy identification |
| **Image** | `postgres:15-alpine` | Lightweight PostgreSQL 15 |
| **Database Name** | `saas_multitenant` | Main application database |
| **Username** | `user` | Database user |
| **Password** | `password` | Database password (change in production) |
| **Port** | `5432:5432` | Standard PostgreSQL port |

### Database Schema Structure

The application creates the following schema structure:

```sql
-- Main database: saas_multitenant
├── public schema
│   ├── tenants (central tenant registry)
│   └── drizzle_migrations (public schema migrations)
├── tenant_acme (example tenant schema)
│   ├── users
│   ├── projects  
│   └── _migrations (tenant-specific migration tracking)
└── tenant_testcorp (another tenant schema)
    ├── users
    ├── projects
    └── _migrations
```

### Database Management Commands

```bash
# Check if container is running
docker ps | grep saas_multitenant_demo

# Stop the database
docker stop saas_multitenant_demo

# Start existing container
docker start saas_multitenant_demo

# Remove container (WARNING: This deletes all data)
docker rm -f saas_multitenant_demo

# View logs
docker logs saas_multitenant_demo

# Connect to database directly
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant
```

### Database Connection Verification

Test your database connection:

```sql
-- Connect to database
psql postgresql://user:password@localhost:5432/saas_multitenant

-- Check if connection works
SELECT version();

-- List all schemas (should show public initially)
\dn

-- Exit
\q
```

## Environment Variables

### Setup Instructions

1. **Copy the example file:**
```bash
cp .env.example .env.local
```

2. **Get Clerk credentials from dashboard:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Navigate to your project
   - Copy the API keys from the "API Keys" section

3. **Update the file with your values:**
```bash
# Edit .env.local with your actual values
code .env.local
```

### Required Environment Variables

```bash
# Clerk Authentication - Get from Clerk Dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxx

# Database - Update with your database credentials
DATABASE_URL=postgresql://user:password@localhost:5432/saas_multitenant

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Clerk Webhook Configuration

To enable automatic tenant creation, configure webhooks in Clerk:

1. **Go to Webhooks in Clerk Dashboard**
2. **Create new endpoint:**
   ```
   URL: http://localhost:3000/api/webhooks/clerk
   Events: organization.created, user.created
   ```
3. **Copy the webhook secret** to your `.env.local`

> **Note**: For local development, you may need to use ngrok or similar tool to expose your localhost to Clerk webhooks.

## Verification Steps

### 1. Database Connection Test

```bash
# Test database connection
bun run src/scripts/test-db-connection.ts
```

Create this test script:

```typescript
// src/scripts/test-db-connection.ts
import postgres from 'postgres';

async function testConnection() {
  try {
    const sql = postgres(process.env.DATABASE_URL!);
    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful');
    console.log('📊 PostgreSQL version:', result[0].version);
    await sql.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

testConnection();
```

### 2. Clerk Authentication Test

Visit these URLs to verify Clerk setup:

```bash
# Start development server
bun run dev

# Test these routes:
- http://localhost:3000/auth/sign-in
- http://localhost:3000/auth/sign-up  
- http://localhost:3000/auth/onboarding
```

### 3. Migration System Test

```bash
# Generate and apply migrations
bun run db:generate:public
bun run db:migrate:public

bun run db:generate:tenant  
# Note: No need to run tenant migrations yet - they're applied automatically when tenants are created
```

### 4. Full Flow Test

1. **Sign up for new account** at `http://localhost:3000/auth/sign-up`
2. **Create organization** in the onboarding flow
3. **Verify webhook triggered** (check server logs)
4. **Access tenant dashboard** at `http://your-org-slug.localhost:3000/dashboard`

### 5. Database Verification

After creating a tenant, verify the database structure:

```sql
-- Connect to database
docker exec -it saas_multitenant_demo psql -U user -d saas_multitenant

-- Check that tenant was created
SELECT * FROM public.tenants;

-- List all schemas (should include tenant schemas)
\dn

-- Check tenant schema contents (replace with your tenant name)
\dt tenant_yourslug.*;

-- Exit
\q
```

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check if container is running
docker ps | grep saas_multitenant_demo

# If not running, start it
docker start saas_multitenant_demo
```

**Clerk Webhooks Not Working:**
- For local development, webhooks won't work unless you expose localhost
- Use ngrok or similar: `ngrok http 3000`
- Update webhook URL in Clerk dashboard to your ngrok URL

**Migration Errors:**
```bash
# Reset database if needed
bun run db:reset

# Reapply migrations
bun run db:migrate:all
```

**Environment Variables Not Loading:**
- Ensure `.env.local` exists (not `.env`)
- Restart development server after changes
- Check for typos in variable names

### Development vs Production

**Development Setup** (current):
- Uses Docker PostgreSQL locally  
- HTTP localhost URLs
- Development Clerk instance

**Production Considerations**:
- Use managed PostgreSQL service
- HTTPS URLs required
- Production Clerk instance
- Environment variable security
- Connection pooling optimization

## Next Steps

After completing the environment setup:

1. **Run the application**: `bun run dev`
2. **Create your first tenant** through the sign-up flow
3. **Explore the dashboard** functionality
4. **Test multi-tenant isolation** by creating multiple organizations
5. **Review the technical documentation** for architecture details

For detailed implementation information, see:
- `docs/comprehensive-multitenant-guide.md` - Complete setup guide
- `docs/technical-architecture.md` - Technical deep dive
- `SECURITY-FIXES.md` - Security considerations