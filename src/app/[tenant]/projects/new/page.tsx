import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable } from "@/db/schemas/tenant";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default async function NewProjectPage({
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

  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Verificar permisos para crear proyectos
  if (!["owner", "admin", "member"].includes(currentUser?.role || "")) {
    redirect(`/${params.tenant}/projects`);
  }

  return <NewProjectForm tenant={params.tenant} />;
}