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

interface Project {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean | null;
}

interface User {
  id: string;
  firstName: string | null;
  role: string;
}

interface ProjectsListProps {
  projects: Project[];
  currentUser: User | null;
  tenant: string;
}

export function ProjectsList({ projects, currentUser, tenant }: ProjectsListProps) {
  const canCreateProject = ["owner", "admin", "member"].includes(
    currentUser?.role || ""
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Proyectos</h2>
        {canCreateProject && (
          <Button asChild>
            <Link href={`/${tenant}/projects/new`}>Nuevo Proyecto</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>
                {project.isPublic ? "🌍 Público" : "🔒 Privado"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {project.description || "Sin descripción"}
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/${tenant}/projects/${project.slug}`}>
                  Ver Proyecto
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No hay proyectos disponibles
            </p>
            {canCreateProject && (
              <Button asChild>
                <Link href={`/${tenant}/projects/new`}>
                  Crear el primer proyecto
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}