import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable, createProjectsTable } from "@/db/schemas/tenant";
import { eq, or } from "drizzle-orm";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function ProjectsPage({
  params,
}: {
  params: { tenant: string };
}) {
  const { userId } = await auth();
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
    <ProjectsList 
      projects={allProjects}
      currentUser={currentUser || null}
      tenant={params.tenant}
    />
  );
}