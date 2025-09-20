import { auth } from "@clerk/nextjs/server";
import { TenantManager } from "@/db/config/tenant-manager";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { clerkOrgId, name, slug } = await req.json();

    const result = await TenantManager.createTenant(clerkOrgId, name, slug);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json(
      { error: "Error al crear tenant" },
      { status: 500 }
    );
  }
}