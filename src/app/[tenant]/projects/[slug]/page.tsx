import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createProjectsTable, createUsersTable } from "@/db/schemas/tenant";
import { eq, or, and } from "drizzle-orm";
import { ProjectDetail } from "@/components/projects/project-detail";

interface ProjectPageProps {
  params: Promise<{ tenant: string; slug: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { userId } = await auth();
  if (!userId) return null;

  const { tenant: tenantSlug, slug } = await params;
  const tenant = await TenantManager.getTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const tenantDb = getTenantDb(tenant.schemaName);
  const projects = createProjectsTable(tenant.schemaName);
  const users = createUsersTable(tenant.schemaName);

  // Get current user for permission checking
  const [currentUser] = await tenantDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!currentUser) {
    redirect("/auth/onboarding");
  }

  // Get project with permission-based filtering
  let projectQuery;
  if (["owner", "admin"].includes(currentUser.role)) {
    // Can see all projects
    projectQuery = tenantDb
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
  } else {
    // Can only see public projects or own projects
    projectQuery = tenantDb
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.slug, slug),
          or(
            eq(projects.isPublic, true),
            eq(projects.createdBy, userId)
          )
        )
      )
      .limit(1);
  }

  const [project] = await projectQuery;

  if (!project) {
    notFound();
  }

  return (
    <ProjectDetail 
      project={project}
      currentUser={currentUser}
      tenant={tenantSlug}
    />
  );
}