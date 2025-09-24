# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `bun run dev` - Start development server with Turbopack
- `bun run build` - Build the application with Turbopack
- `bun start` - Start production server
- `bun run lint` - Run ESLint

### Package Management

This project uses bun as the package manager (indicated by `bun.lock` file).

## Project Overview

This is a **production-ready multi-tenant SaaS application** that demonstrates:

- Advanced multi-tenant architecture using PostgreSQL schema-per-tenant isolation
- Webhook-based automatic tenant provisioning via Clerk Organizations
- Sophisticated migration system with tracking and rollback capabilities
- Path-based tenant routing (e.g., `localhost:3000/acme/dashboard`)
- Role-based permissions system (owner, admin, member, viewer)
- Complete data isolation between tenants with security best practices

## Architecture

This is a Next.js 15.5.3 application using the App Router architecture with:

- **Framework**: Next.js with App Router (src/app directory structure)
- **Authentication**: Clerk with Organizations support
- **Database**: PostgreSQL with DrizzleORM (schema-per-tenant architecture)
- **UI Components**: Shadcn/ui with Tailwind CSS v4
- **TypeScript**: Strict TypeScript configuration with path aliases (`@/*` maps to `./src/*`)
- **Styling**: Tailwind CSS v4 with PostCSS integration
- **Fonts**: Geist Sans and Geist Mono from Google Fonts
- **Build Tool**: Turbopack for both development and production builds

### Project Structure

- `src/app/` - App Router pages and layouts
  - `layout.tsx` - Root layout with font configuration and metadata
  - `page.tsx` - Home page component
  - `globals.css` - Global styles with Tailwind and CSS custom properties
  - `auth/` - Authentication pages (sign-in, sign-up, onboarding)
  - `[tenant]/` - Dynamic tenant routes with subdomain-based routing
  - `api/` - API routes for tenant and project management
- `src/db/` - Database configuration and schemas
- `src/components/` - Reusable UI components
- `src/lib/` - Utility functions and permissions
- `public/` - Static assets
- `docs/` - Complete implementation guide in Spanish

### Key Features

- **Advanced Multi-tenant Architecture**: Each tenant gets its own PostgreSQL schema with complete isolation
- **Database Compatibility**: Works consistently across PostgreSQL providers (Docker PostgreSQL, Supabase, etc.)
- **Webhook Integration**: Automatic tenant creation via Clerk organization webhooks
- **Migration System**: Sophisticated database migrations with tracking, rollbacks, and tenant-specific applications
- **Schema-Aware Operations**: All database operations use explicit schema references for cross-database compatibility
- **Subdomain Routing**: Tenants access via `tenant-name.localhost:3000`
- **Authentication Flow**: Sign-up → Organization Creation (webhook) → Automatic Tenant Setup → Dashboard Access
- **Role System**: owner, admin, member, viewer with granular permissions and database-level enforcement
- **Security**: Parameterized queries, input validation, role-based access control, and tenant isolation

### Configuration

- ESLint uses flat config (eslint.config.mjs) with Next.js core web vitals and TypeScript rules
- PostCSS configured for Tailwind CSS v4 (@tailwindcss/postcss)
- Custom CSS properties for theming with dark mode support
- Turbopack enabled for faster builds and development

### Documentation Structure

- **`docs/comprehensive-multitenant-guide.md`** - Complete setup and implementation guide
- **`docs/technical-architecture.md`** - Technical deep dive and system architecture  
- **`docs/migration-workflow.md`** - Database migration and schema change processes
- **`docs/environment-setup.md`** - Environment configuration and Clerk setup

## Development Rules

1. **No Package Commands**: Never execute commands from package.json (e.g., `bun run dev`, `bun run build`). Ask the user to run them and share logs when needed.

2. **Small Modular Commits**: Work on small, focused changes. When ready for review, suggest commit titles and descriptions. The user will review and create commits.

3. **Follow DRY Principles**: Avoid code repetition and follow Don't Repeat Yourself guidelines throughout the implementation.

4. **Reference Documentation First**: Before starting any task, always reference the appropriate documentation:
   - For setup issues: `docs/environment-setup.md`
   - For architecture questions: `docs/technical-architecture.md`
   - For schema changes: `docs/migration-workflow.md`
   - For implementation guidance: `docs/comprehensive-multitenant-guide.md`

5. **Migration System**: When making schema changes, always follow the migration workflow:
   - Modify schema files in `src/db/schemas/`
   - Generate migrations with `bun run db:generate:tenant`
   - Replace `"tenant"` with `$TENANT_SCHEMA$` in generated files
   - Test with existing tenants using `bun run db:migrate:tenants`

6. **Schema-Aware Database Operations**: Always use schema-aware table references:
   - Use `createUsersTable(tenant.schemaName)` instead of `createUsersTable()`
   - Use `createProjectsTable(tenant.schemaName)` instead of `createProjectsTable()`
   - This ensures compatibility across different PostgreSQL providers

7. **Server Components First**: Use Server Components pattern as the default. Pages should be server components to enable server-side queries, fetches, and redirects. Only use Client Components when interactivity is required. Follow component folder structure: `/components/[domain]/[component-name]/component-name.tsx` with barrel exports via `index.ts`.
