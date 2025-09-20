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

    // Input validation
    if (!clerkOrgId || !name || !slug) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: clerkOrgId, name, slug" },
        { status: 400 }
      );
    }

    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "El nombre debe tener al menos 2 caracteres" },
        { status: 400 }
      );
    }

    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        {
          error:
            "El slug debe contener solo letras minúsculas, números y guiones",
        },
        { status: 400 }
      );
    }

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
