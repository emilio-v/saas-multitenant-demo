import { currentUser } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable } from "@/db/schemas/tenant";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { role = "member" } = await req.json();
    const { slug } = await params;

    const tenant = await TenantManager.getTenantBySlug(slug);
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
