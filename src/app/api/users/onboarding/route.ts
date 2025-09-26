import { createUsersTable } from "@/db/schemas/tenant";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getApiTenantContext } from "@/lib/api-tenant-context";

export async function POST() {
  const context = await getApiTenantContext();
  
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { tenantDb, tenantRecord, userId } = context;

  try {
    const users = createUsersTable(tenantRecord.schemaName);

    // Update user metadata to mark onboarding as complete
    await tenantDb
      .update(users)
      .set({
        metadata: { onboardingComplete: true },
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ 
      success: true,
      message: "Onboarding completed successfully" 
    });
  } catch (error) {
    console.error("Error completing onboarding:", {
      error,
      userId,
      tenantSlug: tenantRecord.slug,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: "Error al completar onboarding",
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}