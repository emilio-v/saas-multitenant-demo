"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { hasPermission } from "@/lib/permissions";

interface Project {
  id: number;
  name: string;
  slug: string;
  isPublic: boolean | null;
}

interface User {
  id: string;
  firstName: string | null;
  role: string;
}

interface DashboardViewProps {
  currentUser: User | null;
  recentProjects: Project[];
  totalProjects: number;
  totalUsers: number;
  tenant: string;
}

export function DashboardView({
  currentUser,
  recentProjects,
  totalProjects,
  totalUsers,
  tenant: _tenantSlug,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Bienvenido, {currentUser?.firstName || "Usuario"}
        </h2>
        <p className="text-muted-foreground">
          Tu rol: <span className="capitalize">{currentUser?.role}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Proyectos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tus Proyectos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentProjects.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Miembros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proyectos Recientes</CardTitle>
          <CardDescription>Tus últimos proyectos creados</CardDescription>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                No tienes proyectos aún
              </p>
              {hasPermission(currentUser?.role || "", "projects:create") && (
                <Button asChild>
                  <Link href="/projects/new">
                    Crear tu primer proyecto
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded"
                >
                  <div>
                    <h4 className="font-medium">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {project.isPublic ? "Público" : "Privado"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${project.slug}`}>
                      Ver
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}