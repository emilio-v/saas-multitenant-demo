"use client";

import {
  Card,
  CardContent,
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
  description: string | null;
  isPublic: boolean | null;
  createdBy: string;
  createdAt: Date;
}

interface User {
  id: string;
  firstName: string | null;
  role: string;
}

interface ProjectDetailProps {
  project: Project;
  currentUser: User;
  tenant: string;
}

export function ProjectDetail({ project, currentUser, tenant: _tenantSlug }: ProjectDetailProps) {
  const canEdit = hasPermission(currentUser.role, "projects:edit:all") || 
    (hasPermission(currentUser.role, "projects:edit:own") && project.createdBy === currentUser.id);
  
  const canDelete = hasPermission(currentUser.role, "projects:delete:all") || 
    (hasPermission(currentUser.role, "projects:delete:own") && project.createdBy === currentUser.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-2">
            {project.isPublic ? "🌍 Proyecto Público" : "🔒 Proyecto Privado"}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/projects">← Volver a Proyectos</Link>
          </Button>
          
          {canEdit && (
            <Button variant="outline">
              Editar Proyecto
            </Button>
          )}
          
          {canDelete && (
            <Button variant="destructive">
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Descripción del Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {project.description || "No hay descripción disponible."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información del Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Identificador:</span>
              <span className="ml-2 text-muted-foreground">{project.slug}</span>
            </div>
            <div>
              <span className="font-medium">Visibilidad:</span>
              <span className="ml-2 text-muted-foreground">
                {project.isPublic ? "Público" : "Privado"}
              </span>
            </div>
            <div>
              <span className="font-medium">Creado:</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium">ID:</span>
              <span className="ml-2 text-muted-foreground">{project.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Future: Add project content, files, collaborators, etc. */}
    </div>
  );
}