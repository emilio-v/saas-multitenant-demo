import { currentUser } from "@clerk/nextjs/server";
import { getTenantDb } from "@/db/config/database";
import { TenantManager } from "@/db/config/tenant-manager";
import { createUsersTable } from "@/db/schemas/tenant";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
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

    // First, check if the user exists in the tenant database
    const existingUser = await tenantDb
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (existingUser.length === 0) {
      console.error("User not found in tenant database:", {
        userId: user.id,
        tenantSlug: slug,
        schemaName: tenant.schemaName
      });
      return NextResponse.json(
        { error: "Usuario no encontrado en el tenant" },
        { status: 404 }
      );
    }

    // Update user metadata to mark onboarding as complete
    await tenantDb
      .update(users)
      .set({
        metadata: { onboardingComplete: true },
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ 
      success: true,
      message: "Onboarding completed successfully" 
    });
  } catch (error) {
    console.error("Error completing onboarding:", {
      error,
      userId: user.id,
      slug: await params.then(p => p.slug),
      timestamp: new Date().toISOString()
    });
    
    // Check if it's a database connection error
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { 
        error: "Error al completar onboarding",
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}