# Multi-Tenant SaaS Demo

A production-ready multi-tenant SaaS application built with Next.js 15, demonstrating schema-per-tenant architecture with PostgreSQL, Clerk authentication, and advanced database management.

## 🏗️ Architecture Overview

- **Multi-tenant Architecture**: Each tenant gets its own PostgreSQL schema
- **Subdomain Routing**: Tenants access via `tenant-name.localhost:3000`
- **Authentication Flow**: Sign-up → Onboarding → Organization Creation → Tenant Setup
- **Role System**: owner, admin, member, viewer with granular permissions
- **Database Isolation**: Complete data separation between tenants

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router and Turbopack
- **Authentication**: Clerk with Organizations support
- **Database**: PostgreSQL with DrizzleORM (schema-per-tenant)
- **UI Components**: Shadcn/ui with Tailwind CSS v4
- **TypeScript**: Strict configuration with path aliases
- **Package Manager**: Bun

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

### 2. Environment Setup

Create `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/multitenant_db"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/auth/onboarding"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/auth/onboarding"
```

### 3. Database Setup

#### Option A: Fresh Start (Recommended)
```bash
# If migrations don't exist, generate them first
bun run db:generate:all

# Apply existing migrations to database
bun run db:migrate:all
```

**Note**: If migration files already exist in `src/db/migrations/`, skip the generate step and run `bun run db:migrate:all` directly.

#### Option B: Complete Reset (if needed)
```bash
# Reset everything and apply fresh migrations
bun run db:reset

# OR nuclear option - completely empty database
bun run db:empty
```

### 4. Development

```bash
# Start development server
bun run dev
```

Visit `http://localhost:3000` to see the application.

## 🗃️ Database Scripts

### Migration Management
- `bun run db:generate:public` - Generate public schema migrations
- `bun run db:generate:tenant` - Generate tenant schema migrations
- `bun run db:generate:all` - Generate all migrations
- `bun run db:migrate:public` - Apply public migrations
- `bun run db:migrate:tenants` - Apply tenant migrations to all tenants
- `bun run db:migrate:all` - Apply all migrations

### Database Reset Options
- `bun run db:reset` - Complete reset with fresh migrations (recommended)
- `bun run db:empty` - Nuclear option - completely empty database

## 🏢 Multi-Tenant Flow

### 1. User Registration
1. User signs up via Clerk
2. Redirected to onboarding
3. User creates organization
4. System creates tenant schema
5. User added to tenant with owner role

### 2. Tenant Access
- **URL Format**: `http://tenant-slug.localhost:3000`
- **Schema Isolation**: Each tenant has separate `tenant_xxx` schema
- **Role-Based Access**: Different permissions per user role

### 3. Data Structure
```
public schema:
├── tenants (tenant metadata)

tenant_xxx schema:
├── users (tenant-specific users)
├── projects (tenant-specific projects)
└── ... (other tenant data)
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

- `docs/complete-multitenant-guide.md` - Comprehensive implementation guide
- `docs/implementation-tasks.md` - Development roadmap and tasks
- `CLAUDE.md` - Development guidelines and rules

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