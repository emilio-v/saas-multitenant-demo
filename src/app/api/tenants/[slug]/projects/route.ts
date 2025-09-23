import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createProjectsTable, createUsersTable } from "@/db/schemas/tenant";
import { eq, or, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId, orgSlug } = await auth();
  const { slug } = await params;

  if (!userId || orgSlug !== slug) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const tenant = await TenantManager.getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantDb = getTenantDb(tenant.schemaName);
    const projects = createProjectsTable();
    const users = createUsersTable();

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

    let allProjects;

    if (["owner", "admin"].includes(currentUser.role)) {
      // Ver todos los proyectos
      allProjects = await tenantDb.select().from(projects);
    } else {
      // Ver solo proyectos públicos o propios
      allProjects = await tenantDb
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.status, "active"),
            or(eq(projects.isPublic, true), eq(projects.createdBy, userId))
          )
        );
    }

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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId, orgSlug } = await auth();
  const { slug } = await params;

  if (!userId || orgSlug !== slug) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const {
      name,
      description,
      slug: projectSlug,
      isPublic = false,
    } = await req.json();

    const tenant = await TenantManager.getTenantBySlug(slug);
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    const tenantDb = getTenantDb(tenant.schemaName);
    const users = createUsersTable();
    const projects = createProjectsTable();

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

    if (!hasPermission(currentUser.role, "projects:create")) {
      return NextResponse.json(
        { error: "Sin permisos para crear proyectos" },
        { status: 403 }
      );
    }

    const [project] = await tenantDb
      .insert(projects)
      .values({
        name,
        slug: projectSlug || name.toLowerCase().replace(/\s+/g, "-"),
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
