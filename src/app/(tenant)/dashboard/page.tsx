import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTenantDb } from "@/db/config/database";
import { requireCurrentTenantRecord } from "@/lib/tenant-context";
import { createUsersTable, createProjectsTable } from "@/db/schemas/tenant";
import { eq, sql } from "drizzle-orm";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const tenant = await requireCurrentTenantRecord();

  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);

  // Obtener usuario actual
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Si el usuario no existe en la base de datos del tenant, redirigir a onboarding
  if (!currentUser) {
    redirect("/auth/onboarding");
  }

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
    <DashboardView
      currentUser={currentUser}
      recentProjects={recentProjects}
      totalProjects={totalProjects}
      totalUsers={totalUsers}
      tenant={tenant.slug}
    />
  );
}