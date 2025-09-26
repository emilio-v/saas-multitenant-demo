import { createProjectsTable } from "@/db/schemas/tenant";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { getApiTenantContext } from "@/lib/api-tenant-context";

export async function GET() {
  const context = await getApiTenantContext();

  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status }
    );
  }

  const { tenantDb, currentUser, tenantRecord } = context;

  try {
    const projects = createProjectsTable(tenantRecord.schemaName);

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
          or(
            eq(projects.isPublic, true),
            eq(projects.createdBy, context.userId)
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

export async function POST(req: Request) {
  const context = await getApiTenantContext();

  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status }
    );
  }

  const { tenantDb, currentUser, tenantRecord, userId } = context;

  try {
    const {
      name,
      description,
      slug: projectSlug,
      isPublic = false,
    } = await req.json();

    if (!hasPermission(currentUser.role, "projects:create")) {
      return NextResponse.json(
        { error: "Sin permisos para crear proyectos" },
        { status: 403 }
      );
    }

    const projects = createProjectsTable(tenantRecord.schemaName);

    const [project] = await tenantDb
      .insert(projects)
      .values({
        name,
        slug: projectSlug || name.toLowerCase().replace(/\s+/g, "-"),
        description,
        createdBy: userId,
        isPublic,
        createdAt: new Date(),
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
