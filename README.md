# Multi-Tenant SaaS Demo

A production-ready multi-tenant SaaS application built with Next.js 15, demonstrating schema-per-tenant architecture with PostgreSQL, Clerk authentication, and advanced migration system.

## 🏗️ Architecture Overview

- **Multi-tenant Architecture**: Each tenant gets its own PostgreSQL schema with complete isolation
- **Subdomain Routing**: Tenants access via `tenant-name.localhost:3000` 
- **Webhook Integration**: Automatic tenant provisioning via Clerk webhooks
- **Migration System**: Advanced database migrations with tracking and rollback support
- **Role System**: owner, admin, member, viewer with granular permissions
- **Database Isolation**: Complete data separation between tenants

## 🛠️ Tech Stack

- **Framework**: Next.js 15.5.3 with App Router and Turbopack
- **Runtime**: Bun (fast JavaScript runtime and package manager)
- **Authentication**: Clerk with Organizations and webhook support
- **Database**: PostgreSQL 15 with DrizzleORM (schema-per-tenant)
- **UI Components**: Shadcn/ui with Tailwind CSS v4
- **TypeScript**: Strict configuration with path aliases (`@/*`)
- **Build Tool**: Turbopack for development and production

## 📋 Prerequisites

- Node.js 18+ (or Bun)
- PostgreSQL database
- Clerk account for authentication

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd saas-multitenant-demo
bun install
```

### 2. Database Setup

The application supports any PostgreSQL-compatible database. Choose one of:

**Option A: Docker PostgreSQL (Recommended for Development)**
```bash
docker run --name saas_multitenant_demo \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=user \
  -e POSTGRES_DB=saas_multitenant \
  -p 5432:5432 \
  -d postgres:15-alpine
```

**Option B: Supabase (Cloud PostgreSQL)**
1. Create a new project at [supabase.com](https://supabase.com)
2. Get your database URL from Settings > Database
3. Use the connection string in your `.env.local` file

**Option C: Any PostgreSQL Provider**
The system works with any PostgreSQL 12+ database that supports schemas.

### 3. Environment Setup

Copy the environment template:

```bash
cp .env.example .env.local
```

Then update `.env.local` with your values:

```env
# Database - Choose one based on your setup:
# Docker PostgreSQL:
DATABASE_URL="postgresql://user:password@localhost:5432/saas_multitenant"
# Supabase:
# DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Clerk Authentication (get from Clerk Dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..." # Required for automatic tenant creation

# Clerk URLs (default configuration)
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/auth/onboarding"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/auth/onboarding"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Migration

Apply database migrations:

```bash
# Apply all migrations (creates tables and structure)
bun run db:migrate:all
```

> **Note**: Migration files are already included. The system uses an advanced migration tracking system that prevents duplicate applications and supports rollbacks.

### 5. Development

```bash
# Start development server
bun run dev
```

Visit `http://localhost:3000` to see the application.

## 🗃️ Database Management

### Migration Commands
- `bun run db:migrate:all` - Apply all migrations (recommended for setup)
- `bun run db:migrate:public` - Apply public schema migrations only
- `bun run db:migrate:tenants` - Apply tenant migrations to existing tenants

### Schema Change Workflow
- `bun run db:generate:tenant` - Generate new migration after schema changes
- `bun run db:generate:public` - Generate public schema migrations
- `bun run db:generate:all` - Generate all migration types

### Database Reset (Development Only)
- `bun run db:reset` - Complete reset with fresh migrations
- `bun run db:empty` - Empty database completely

> **📚 For detailed migration workflows**, see `docs/migration-workflow.md`

## 🏢 Multi-Tenant Flow

### 1. User Registration (Automated via Webhooks)
1. User signs up via Clerk
2. User creates organization in onboarding flow
3. **Webhook triggers automatic tenant creation**:
   - Creates `tenant_xxx` PostgreSQL schema
   - Applies all migrations to new tenant
   - Creates owner user in tenant database
4. User redirected to tenant dashboard

### 2. Tenant Access
- **URL Format**: `http://tenant-slug.localhost:3000`
- **Schema Isolation**: Each tenant has separate `tenant_xxx` schema
- **Role-Based Access**: Different permissions per user role

### 3. Data Structure
```
saas_multitenant database:
│
├── public schema:
│   └── tenants (tenant registry and metadata)
│
├── tenant_acme schema:
│   ├── users (tenant-specific users)
│   ├── projects (tenant-specific projects)
│   └── _migrations (migration tracking)
│
└── tenant_testcorp schema:
    ├── users (tenant-specific users)
    ├── projects (tenant-specific projects)  
    └── _migrations (migration tracking)
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [tenant]/          # Dynamic tenant routes
│   ├── auth/              # Authentication pages
│   └── api/               # API routes
├── components/            # Reusable UI components
├── db/
│   ├── config/           # Database configuration
│   ├── migrations/       # Generated migration files
│   │   ├── public/       # Public schema migrations
│   │   └── tenant/       # Tenant schema migrations
│   └── schemas/          # Drizzle schema definitions
│       ├── public/       # Public schema (tenants table)
│       └── tenant/       # Tenant schema (users, projects)
├── lib/                  # Utility functions
└── scripts/              # Database management scripts
```

## 🔧 Available Scripts

### Development
- `bun run dev` - Start development server with Turbopack
- `bun run build` - Build for production with Turbopack
- `bun run start` - Start production server
- `bun run lint` - Run ESLint

### Database (see Database Scripts section above)

## 🔐 Authentication & Roles

### Roles & Permissions
- **owner**: Full access to everything
- **admin**: Manage users and projects
- **member**: Create and manage own projects
- **viewer**: Read-only access

### Authentication Flow
1. Clerk handles user authentication
2. User creates/joins organization
3. Webhook creates tenant schema
4. User added to tenant database
5. Role-based access controls applied

## 🚀 Production Deployment

### Environment Variables
Ensure all environment variables are set in your production environment.

### Database Migrations
```bash
# In production, run migrations
bun run db:migrate:all
```

### Subdomain Setup
Configure your DNS and reverse proxy to handle subdomain routing for tenants.

## 📚 Documentation

- **`docs/comprehensive-multitenant-guide.md`** - Complete setup and implementation guide
- **`docs/technical-architecture.md`** - Technical deep dive and system architecture
- **`docs/migration-workflow.md`** - Database migration and schema change workflow
- **`docs/environment-setup.md`** - Environment configuration and Clerk setup
- **`CLAUDE.md`** - Development guidelines and AI assistant rules

## 🧪 Development Guidelines

1. **No Package Commands**: Never run package commands in chat - ask user to run them
2. **Small Modular Commits**: Work on focused changes with proper commit messages
3. **DRY Principles**: Follow Don't Repeat Yourself throughout
4. **Server Components First**: Use Server Components as default, Client only when needed
5. **Reference Guide**: Check `docs/` before starting tasks

## 🆘 Troubleshooting

### Database Issues
```bash
# Reset everything
bun run db:reset

# Check current state
psql $DATABASE_URL -c "\dn"  # List schemas
```

### Authentication Issues
- Verify Clerk environment variables
- Check webhook configuration
- Ensure redirect URLs are correct

### Tenant Access Issues
- Verify subdomain DNS configuration
- Check tenant exists in database
- Confirm user has access to tenant

## 🤝 Contributing

1. Check existing tasks in `docs/implementation-tasks.md`
2. Create feature branch for changes
3. Follow established patterns and guidelines
4. Test thoroughly before submitting

## 📄 License

[Add your license information here]