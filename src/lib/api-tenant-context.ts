import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { TenantManager } from "@/db/config/tenant-manager";
import { getTenantDb } from "@/db/config/database";
import { createUsersTable } from "@/db/schemas/tenant";
import { eq } from "drizzle-orm";

export interface TenantUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  metadata: unknown;
  isActive: boolean | null;
  lastSeenAt: Date | null;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiTenantContext {
  userId: string;
  orgSlug: string;
  tenantRecord: Awaited<ReturnType<typeof TenantManager.getTenantBySlug>>;
  tenantDb: ReturnType<typeof getTenantDb>;
  currentUser: TenantUser;
}

export async function getApiTenantContext(): Promise<
  ApiTenantContext | { error: string; status: number }
> {
  const { userId, orgSlug } = await auth();

  if (!userId || !orgSlug) {
    return { error: "No autorizado", status: 401 };
  }

  // Try to get tenant from header first, fallback to orgSlug
  const headersList = await headers();
  const tenantFromHeader = headersList.get("x-current-tenant");
  const tenantSlug = tenantFromHeader || orgSlug;

  // Security check: ensure user's org matches requested tenant
  if (tenantSlug !== orgSlug) {
    return { error: "Acceso no autorizado al tenant", status: 403 };
  }

  try {
    const tenantRecord = await TenantManager.getTenantBySlug(tenantSlug);
    if (!tenantRecord) {
      return { error: "Tenant no encontrado", status: 404 };
    }

    const tenantDb = getTenantDb(tenantRecord.schemaName);
    const users = createUsersTable(tenantRecord.schemaName);

    const [currentUser] = await tenantDb
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return { error: "Usuario no encontrado en el tenant", status: 404 };
    }

    return {
      userId,
      orgSlug,
      tenantRecord,
      tenantDb,
      currentUser,
    };
  } catch (error) {
    console.error("Error getting tenant context:", error);
    return { error: "Error interno del servidor", status: 500 };
  }
}
