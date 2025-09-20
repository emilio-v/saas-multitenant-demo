"use client";

import { useAuth, useOrganizationList, useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Onboarding() {
  const { isLoaded: authLoaded, userId } = useAuth();
  const { user } = useUser();
  const { userMemberships, createOrganization, setActive } =
    useOrganizationList({
      userMemberships: true
    });
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    slug: "",
  });

  useEffect(() => {
    if (authLoaded && !userId) {
      router.push("/auth/sign-in");
      return;
    }

    // Si ya tiene una organización, redirigir
    if (userMemberships?.data && userMemberships.data.length > 0) {
      const org = userMemberships.data[0];
      router.push(`/${org.organization.slug}/dashboard`);
    }
  }, [authLoaded, userId, userMemberships, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrganization || !setActive) return;

    setLoading(true);

    try {
      // Crear organización en Clerk
      const org = await createOrganization({
        name: formData.orgName,
        slug: formData.slug,
      });

      // Activar la organización
      await setActive({ organization: org.id });

      // Crear tenant en base de datos
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkOrgId: org.id,
          name: formData.orgName,
          slug: formData.slug,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear el tenant");
      }

      // Crear usuario en el tenant como owner
      const userResponse = await fetch(`/api/tenants/${formData.slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "owner",
        }),
      });

      if (!userResponse.ok) {
        throw new Error("Error al crear el usuario");
      }

      // Redirigir al dashboard
      router.push(`/${formData.slug}/dashboard`);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al crear la organización. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>Bienvenido, {user?.firstName || "Usuario"}</CardTitle>
          <CardDescription>Crea tu organización para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Nombre de la organización</Label>
              <Input
                id="orgName"
                value={formData.orgName}
                onChange={(e) =>
                  setFormData({ ...formData, orgName: e.target.value })
                }
                placeholder="Mi Empresa"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identificador único (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  })
                }
                placeholder="mi-empresa"
                pattern="[a-z0-9-]+"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Tu URL será: {formData.slug || "mi-empresa"}.localhost:3000
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear Organización"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}