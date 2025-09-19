# Guía Completa: Dashboard SaaS Multi-Tenant con Clerk

## 🎯 Objetivo del Proyecto

Construir un dashboard SaaS multi-tenant con:

- Arquitectura multi-tenant por Schema (PostgreSQL)
- Usuarios que pertenecen solo a un tenant
- Autenticación por subdominios
- Sistema de roles simple (owner, admin, member, viewer)
- Integración con Clerk Organizations

## 📚 Stack Tecnológico

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes, DrizzleORM
- **Base de Datos**: PostgreSQL (schemas separados por tenant)
- **Autenticación**: Clerk
- **Runtime**: Bun

## 🚀 Paso 1: Configuración Inicial del Proyecto

### 1.1 Crear el proyecto Next.js

```bash
bunx create-next-app@latest saas-multitenant-demo
```

Opciones recomendadas:

- ✅ TypeScript
- ✅ ESLint
- ✅ Tailwind CSS
- ✅ `src/` directory
- ✅ App Router
- ❌ No customize import alias

### 1.2 Instalar dependencias

```bash
cd saas-multitenant-demo
bun add @clerk/nextjs drizzle-orm postgres
bun add -d drizzle-kit @types/node
```

### 1.3 Instalar y configurar Shadcn/ui

```bash
bunx shadcn@latest init
```

Opciones recomendadas para shadcn:

- Style: Default
- Base color: Slate
- CSS variables: Yes

Instalar componentes básicos:

```bash
bunx shadcn@latest add button card input label
```

## 🗂️ Paso 2: Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   └── tenants/
│   │       ├── route.ts
│   │       └── [slug]/
│   │           ├── users/
│   │           │   └── route.ts
│   │           └── projects/
│   │               └── route.ts
│   ├── auth/
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx
│   │   └── onboarding/
│   │       └── page.tsx
│   ├── [tenant]/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   └── layout.tsx
├── components/
│   ├── auth/
│   │   └── user-button.tsx
│   └── ui/
│       └── (shadcn components)
├── db/
│   ├── config/
│   │   ├── database.ts
│   │   └── tenant-manager.ts
│   ├── schemas/
│   │   ├── public/
│   │   │   └── tenants.ts
│   │   └── tenant/
│   │       ├── users.ts
│   │       ├── projects.ts
│   │       └── index.ts
│   └── migrations/
│       ├── public/
│       │   └── 0001_create_tenants.sql
│       └── tenant/
│           └── 0001_initial_schema.sql
├── lib/
│   ├── permissions.ts
│   ├── tenant-context.tsx
│   └── tenant-middleware.ts
└── middleware.ts
```

## 🔐 Paso 3: Configuración de Clerk

### 3.1 Crear cuenta en Clerk

1. Ir a [clerk.com](https://clerk.com) y crear una cuenta
2. Crear una nueva aplicación
3. Seleccionar "Email" como método de autenticación principal

### 3.2 Configurar Organizations en Clerk Dashboard

1. En el dashboard de Clerk, ir a **Organizations** → **Settings**
2. Activar **Organizations**
3. Configurar:
   - ✅ Enable organizations
   - ✅ Limit members to 1 organization
   - ❌ Don't allow users to delete their own organization

### 3.3 Configurar roles en Clerk

1. Ir a **Organizations** → **Roles**
2. Crear los siguientes roles:
   - `org:owner`: Organization Owner
   - `org:admin`: Administrator
   - `org:member`: Member
   - `org:viewer`: Viewer

### 3.4 Variables de entorno

Crear archivo `.env.local`:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/auth/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/auth/onboarding

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/saas_multitenant

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🗄️ Paso 4: Configuración de Base de Datos

### 4.1 Schemas de Base de Datos

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

// src/db/schemas/tenant/users.ts
import { pgTable, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const createUsersTable = (schemaName: string) => {
  return pgTable(`${schemaName}.users`, {
    id: varchar("id", { length: 255 }).primaryKey(), // clerk_user_id
    email: varchar("email", { length: 255 }).unique().notNull(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    role: varchar("role", { length: 50 }).default("member").notNull(),
    isActive: boolean("is_active").default(true),
    lastSeenAt: timestamp("last_seen_at"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  });
};

// src/db/schemas/tenant/projects.ts
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const createProjectsTable = (schemaName: string) => {
  return pgTable(`${schemaName}.projects`, {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    description: text("description"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    isPublic: boolean("is_public").default(false),
    status: varchar("status", { length: 50 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  });
};

// src/db/schemas/tenant/index.ts
export * from "./users";
export * from "./projects";
```

### 4.2 Configuración de la base de datos

```typescript
// src/db/config/database.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql);

const tenantConnections = new Map<string, postgres.Sql>();

export function getTenantDb(schemaName: string) {
  if (!tenantConnections.has(schemaName)) {
    const tenantSql = postgres(process.env.DATABASE_URL!, {
      connection: {
        search_path: schemaName,
      },
    });
    tenantConnections.set(schemaName, tenantSql);
  }

  const sql = tenantConnections.get(schemaName)!;
  return drizzle(sql);
}

export async function closeTenantConnections() {
  for (const [_, connection] of tenantConnections) {
    await connection.end();
  }
  tenantConnections.clear();
}
```

### 4.3 Tenant Manager

```typescript
// src/db/config/tenant-manager.ts
import { db, getTenantDb } from "./database";
import { tenants } from "../schemas/public/tenants";
import { eq } from "drizzle-orm";

export class TenantManager {
  static async createTenant(clerkOrgId: string, name: string, slug: string) {
    const schemaName = `tenant_${slug.replace(/-/g, "_")}`;

    try {
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
      await this.dropTenant(schemaName);
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

### 4.4 Migración inicial

```sql
-- src/db/migrations/public/0001_create_tenants.sql
CREATE TABLE IF NOT EXISTS public.tenants (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 🔧 Paso 5: Configuración de Middleware

```typescript
// src/middleware.ts
import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/", "/auth/sign-in", "/auth/sign-up", "/api/webhooks(.*)"],
  ignoredRoutes: ["/(.*).png", "/(.*).jpg", "/(.*).ico"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## 🎨 Paso 6: Layout Principal

```tsx
// src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

## 🔐 Paso 7: Páginas de Autenticación

### 7.1 Sign In

```tsx
// src/app/auth/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn />
    </div>
  );
}
```

### 7.2 Sign Up

```tsx
// src/app/auth/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp />
    </div>
  );
}
```

### 7.3 Onboarding

```tsx
// src/app/auth/onboarding/page.tsx
"use client";

import { useAuth, useOrganizationList, useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { user } = useUser();
  const { organizationList, createOrganization, setActive } =
    useOrganizationList();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    slug: "",
  });

  useEffect(() => {
    if (authLoaded && !userId) {
      router.push("/auth/sign-in");
      return;
    }

    // Si ya tiene una organización, redirigir
    if (organizationList && organizationList.length > 0) {
      const org = organizationList[0];
      router.push(`/${org.organization.slug}/dashboard`);
    }
  }, [authLoaded, userId, organizationList, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrganization || !setActive) return;

    setLoading(true);

    try {
      // Crear organización en Clerk
      const org = await createOrganization({
        name: formData.orgName,
        slug: formData.slug,
      });

      // Activar la organización
      await setActive({ organization: org.id });

      // Crear tenant en base de datos
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkOrgId: org.id,
          name: formData.orgName,
          slug: formData.slug,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear el tenant");
      }

      // Crear usuario en el tenant como owner
      const userResponse = await fetch(`/api/tenants/${formData.slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "owner",
        }),
      });

      if (!userResponse.ok) {
        throw new Error("Error al crear el usuario");
      }

      // Redirigir al dashboard
      router.push(`/${formData.slug}/dashboard`);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al crear la organización. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>Bienvenido, {user?.firstName || "Usuario"}</CardTitle>
          <CardDescription>Crea tu organización para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nombre de la organización</Label>
              <Input
                id="orgName"
                value={formData.orgName}
                onChange={(e) =>
                  setFormData({ ...formData, orgName: e.target.value })
                }
                placeholder="Mi Empresa"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identificador único (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder="mi-empresa"
                pattern="[a-z0-9-]+"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Tu URL será: {formData.slug || "mi-empresa"}.localhost:3000
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear Organización"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 🏢 Paso 8: Layout del Tenant

```tsx
// src/app/[tenant]/layout.tsx
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { TenantManager } from "@/db/config/tenant-manager";
import { UserButton } from "@clerk/nextjs";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: { tenant: string };
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { userId, orgId, orgSlug } = auth();

  // Verificar autenticación
  if (!userId) {
    redirect("/auth/sign-in");
  }

  // Verificar que el usuario tiene una organización
  if (!orgId || !orgSlug) {
    redirect("/auth/onboarding");
  }

  // Verificar que el slug de la URL coincide con la org del usuario
  if (params.tenant !== orgSlug) {
    redirect(`/${orgSlug}/dashboard`);
  }

  // Verificar que el tenant existe
  const tenant = await TenantManager.getTenantBySlug(params.tenant);
  if (!tenant) {
    redirect("/auth/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{tenant.name}</h1>
            </div>

            <div className="flex items-center space-x-4">
              <nav className="flex space-x-4">
                <a
                  href={`/${params.tenant}/dashboard`}
                  className="text-gray-700 hover:text-gray-900"
                >
                  Dashboard
                </a>
                <a
                  href={`/${params.tenant}/projects`}
                  className="text-gray-700 hover:text-gray-900"
                >
                  Proyectos
                </a>
              </nav>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
```

## 📊 Paso 9: Dashboard y Proyectos

### 9.1 Dashboard

```tsx
// src/app/[tenant]/dashboard/page.tsx
import { auth } from "@clerk/nextjs";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable, createProjectsTable } from "@/db/schemas/tenant";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: { tenant: string };
}) {
  const { userId } = auth();
  if (!userId) return null;

  const tenant = await TenantManager.getTenantBySlug(params.tenant);
  if (!tenant) return null;

  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);

  // Obtener usuario actual
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Obtener proyectos recientes del usuario
  const recentProjects = await tenantDb
    .select()
    .from(projects)
    .where(eq(projects.createdBy, userId))
    .limit(5)
    .orderBy(projects.createdAt);

  // Contar totales
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

      <Card>
        <CardHeader>
          <CardTitle>Proyectos Recientes</CardTitle>
          <CardDescription>Tus últimos proyectos creados</CardDescription>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                No tienes proyectos aún
              </p>
              {["owner", "admin", "member"].includes(
                currentUser?.role || ""
              ) && (
                <Button asChild>
                  <Link href={`/${params.tenant}/projects/new`}>
                    Crear tu primer proyecto
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded"
                >
                  <div>
                    <h4 className="font-medium">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {project.isPublic ? "Público" : "Privado"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${params.tenant}/projects/${project.slug}`}>
                      Ver
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 9.2 Lista de Proyectos

```tsx
// src/app/[tenant]/projects/page.tsx
import { auth } from "@clerk/nextjs";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable, createProjectsTable } from "@/db/schemas/tenant";
import { eq, or, and } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ProjectsPage({
  params,
}: {
  params: { tenant: string };
}) {
  const { userId } = auth();
  if (!userId) return null;

  const tenant = await TenantManager.getTenantBySlug(params.tenant);
  if (!tenant) return null;

  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);

  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Obtener proyectos según permisos
  let projectsQuery;
  if (["owner", "admin"].includes(currentUser?.role || "")) {
    // Ver todos los proyectos
    projectsQuery = tenantDb.select().from(projects);
  } else {
    // Ver solo proyectos públicos o propios
    projectsQuery = tenantDb
      .select()
      .from(projects)
      .where(or(eq(projects.isPublic, true), eq(projects.createdBy, userId)));
  }

  const allProjects = await projectsQuery;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Proyectos</h2>
        {["owner", "admin", "member"].includes(currentUser?.role || "") && (
          <Button asChild>
            <Link href={`/${params.tenant}/projects/new`}>Nuevo Proyecto</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>
                {project.isPublic ? "🌍 Público" : "🔒 Privado"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {project.description || "Sin descripción"}
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/${params.tenant}/projects/${project.slug}`}>
                  Ver Proyecto
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {allProjects.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No hay proyectos disponibles
            </p>
            {["owner", "admin", "member"].includes(currentUser?.role || "") && (
              <Button asChild>
                <Link href={`/${params.tenant}/projects/new`}>
                  Crear el primer proyecto
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## 🔌 Paso 10: API Routes

### 10.1 Crear Tenant

```typescript
// src/app/api/tenants/route.ts
import { auth } from "@clerk/nextjs";
import { TenantManager } from "@/db/config/tenant-manager";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { clerkOrgId, name, slug } = await req.json();

    const result = await TenantManager.createTenant(clerkOrgId, name, slug);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Error al crear tenant" },
      { status: 500 }
    );
  }
}
```

### 10.2 Crear Usuario en Tenant

```typescript
// src/app/api/tenants/[slug]/users/route.ts
import { auth, currentUser } from "@clerk/nextjs";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable } from "@/db/schemas/tenant/users";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { role = "member" } = await req.json();

    const tenant = await TenantManager.getTenantBySlug(params.slug);
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantDb = getTenantDb(tenant.schemaName);
    const users = createUsersTable(tenant.schemaName);

    await tenantDb.insert(users).values({
      id: user.id,
      email: user.emailAddresses[0].emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.imageUrl,
      role,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}
```

### 10.3 CRUD de Proyectos

```typescript
// src/app/api/tenants/[slug]/projects/route.ts
import { auth } from "@clerk/nextjs";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createProjectsTable } from "@/db/schemas/tenant/projects";
import { createUsersTable } from "@/db/schemas/tenant/users";
import { eq, or, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { userId, orgSlug } = auth();

  if (!userId || orgSlug !== params.slug) {
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
    const projects = createProjectsTable(tenant.schemaName);
    const users = createUsersTable(tenant.schemaName);

    const [currentUser] = await tenantDb
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    let projectsQuery = tenantDb.select().from(projects);

    if (!["owner", "admin"].includes(currentUser.role)) {
      projectsQuery = projectsQuery.where(
        and(
          eq(projects.status, "active"),
          or(eq(projects.isPublic, true), eq(projects.createdBy, userId))
        )
      );
    }

    const allProjects = await projectsQuery;

    return NextResponse.json(allProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { userId, orgSlug } = auth();

  if (!userId || orgSlug !== params.slug) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { name, description, isPublic = false } = await req.json();

    const tenant = await TenantManager.getTenantBySlug(params.slug);
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantDb = getTenantDb(tenant.schemaName);
    const users = createUsersTable(tenant.schemaName);
    const projects = createProjectsTable(tenant.schemaName);

    const [currentUser] = await tenantDb
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser || currentUser.role === "viewer") {
      return NextResponse.json(
        { error: "Sin permisos para crear proyectos" },
        { status: 403 }
      );
    }

    const [project] = await tenantDb
      .insert(projects)
      .values({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        description,
        createdBy: userId,
        isPublic,
      })
      .returning();

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Error al crear proyecto" },
      { status: 500 }
    );
  }
}
```

## 🛡️ Paso 11: Sistema de Permisos

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

export function hasPermission(userRole: string, permission: string): boolean {
  return rolePermissions[userRole]?.includes(permission) || false;
}
```

## 🚦 Paso 12: Testing con Subdominios

### Opción 1: Wildcard \*.localhost (Recomendado)

En navegadores modernos, cualquier subdominio de `localhost` funciona automáticamente:

```bash
# Funciona sin configuración adicional:
http://org1.localhost:3000
http://org2.localhost:3000
http://mi-empresa.localhost:3000
```

### Opción 2: Configurar /etc/hosts (Si la opción 1 no funciona)

Solo si tu navegador no soporta wildcard localhost:

```bash
# Mac/Linux: /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts

127.0.0.1 localhost
127.0.0.1 org1.localhost
127.0.0.1 org2.localhost
```

### Verificar en el navegador

1. Crear una organización con slug "demo"
2. Visitar: http://demo.localhost:3000
3. Deberías ser redirigido al dashboard

## 📦 Paso 13: Scripts Útiles

### package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:push": "drizzle-kit push:pg",
    "db:generate": "drizzle-kit generate:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

### drizzle.config.ts

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schemas/**/*.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## 🚀 Ejecutar el Proyecto

```bash
# 1. Instalar dependencias
bun install

# 2. Configurar base de datos
createdb saas_multitenant

# 3. Ejecutar migraciones
bun run db:push

# 4. Iniciar servidor de desarrollo
bun run dev
```

Visitar:

- Sign Up: http://localhost:3000/auth/sign-up
- Con organización: http://mi-empresa.localhost:3000/dashboard

## 📋 Checklist de Implementación

- [ ] Crear proyecto Next.js con configuración inicial
- [ ] Configurar Clerk y obtener API keys
- [ ] Crear base de datos PostgreSQL
- [ ] Implementar schemas de DrizzleORM
- [ ] Crear flujo de autenticación
- [ ] Implementar onboarding y creación de tenants
- [ ] Crear APIs para usuarios y proyectos
- [ ] Implementar UI del dashboard
- [ ] Probar con múltiples organizaciones
- [ ] Verificar aislamiento de datos entre tenants

## 🔧 Troubleshooting

1. **Subdominio no funciona**: Verificar que estás usando `.localhost` y no solo el slug
2. **Error de permisos DB**: Asegurar que el usuario PostgreSQL puede crear schemas
3. **Usuario no encontrado**: Verificar que se creó el usuario en el tenant después del onboarding
4. **Redirecciones infinitas**: Limpiar cookies y verificar la configuración de Clerk

## 🎉 ¡Listo!

Ya tienes una aplicación SaaS multi-tenant funcional con:

- ✅ Aislamiento completo por schema
- ✅ Autenticación con Clerk
- ✅ Sistema de roles y permisos
- ✅ Subdominios por organización
- ✅ UI moderna con Shadcn/ui
