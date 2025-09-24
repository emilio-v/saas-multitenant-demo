import { auth } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { requireCurrentTenantRecord } from "@/lib/tenant-context";
import { createUsersTable } from "@/db/schemas/tenant";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default async function NewProjectPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const tenant = await requireCurrentTenantRecord();

  const tenantDb = getTenantDb(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);

  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Verificar permisos para crear proyectos
  if (!["owner", "admin", "member"].includes(currentUser?.role || "")) {
    redirect("/projects");
  }

  return <NewProjectForm tenant={tenant.slug} />;
}