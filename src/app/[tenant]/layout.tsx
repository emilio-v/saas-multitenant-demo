import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TenantManager } from "@/db/config/tenant-manager";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { userId, orgId, orgSlug } = await auth();
  const { tenant } = await params;

  // Verificar autenticación
  if (!userId) {
    redirect("/auth/sign-in");
  }

  // Verificar que el usuario tiene una organización
  if (!orgId || !orgSlug) {
    redirect("/auth/onboarding");
  }

  // Verificar que el slug de la URL coincide con la org del usuario
  if (tenant !== orgSlug) {
    redirect(`/${orgSlug}/dashboard`);
  }

  // Verificar que el tenant existe
  const tenantRecord = await TenantManager.getTenantBySlug(tenant);
  if (!tenantRecord) {
    redirect("/auth/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{tenantRecord.name}</h1>
            </div>

            <div className="flex items-center space-x-4">
              <nav className="flex space-x-4">
                <Link
                  href={`/${tenant}/dashboard`}
                  className="text-gray-700 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/${tenant}/projects`}
                  className="text-gray-700 hover:text-gray-900"
                >
                  Proyectos
                </Link>
              </nav>
              <UserButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}