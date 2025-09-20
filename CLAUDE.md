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

This is a **multi-tenant SaaS dashboard demo** that demonstrates:

- Multi-tenant architecture using PostgreSQL schemas per tenant
- Subdomain-based tenant routing (e.g., `acme.localhost:3000`)
- User authentication with Clerk Organizations
- Role-based permissions (owner, admin, member, viewer)
- Tenant isolation with separate database schemas

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

- **Multi-tenant Architecture**: Each tenant gets its own PostgreSQL schema
- **Subdomain Routing**: Tenants access via `tenant-name.localhost:3000`
- **Authentication Flow**: Sign-up → Onboarding → Organization Creation → Tenant Setup
- **Role System**: owner, admin, member, viewer with granular permissions
- **Database Isolation**: Complete data separation between tenants

### Configuration

- ESLint uses flat config (eslint.config.mjs) with Next.js core web vitals and TypeScript rules
- PostCSS configured for Tailwind CSS v4 (@tailwindcss/postcss)
- Custom CSS properties for theming with dark mode support
- Turbopack enabled for faster builds and development

Refer to `docs/complete-multitenant-guide.md` for detailed implementation steps and architecture explanation.

## Development Rules

1. **No Package Commands**: Never execute commands from package.json (e.g., `bun run dev`, `bun run build`). Ask the user to run them and share logs when needed.

2. **Small Modular Commits**: Work on small, focused changes. When ready for review, suggest commit titles and descriptions. The user will review and create commits.

3. **Follow DRY Principles**: Avoid code repetition and follow Don't Repeat Yourself guidelines throughout the implementation.

4. **Reference Guide First**: Before starting any task, always look up the related topic in `docs/complete-multitenant-guide.md` to get proper context on what will be worked on.

5. **Server Components First**: Use Server Components pattern as the default. Pages should be server components to enable server-side queries, fetches, and redirects. Only use Client Components when interactivity is required. Follow component folder structure: `/components/[domain]/[component-name]/component-name.tsx` with barrel exports via `index.ts`.
