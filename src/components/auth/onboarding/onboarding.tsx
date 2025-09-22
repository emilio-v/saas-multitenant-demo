"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useState} from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Onboarding() {
  const { user } = useUser();
  const { userMemberships } = useOrganizationList({
    userMemberships: true
  });
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCompleteOnboarding = async () => {
    if (!userMemberships?.data || userMemberships.data.length === 0) {
      return;
    }

    setLoading(true);

    try {
      const org = userMemberships.data[0].organization;

      // First, create user in tenant database as owner
      const userResponse = await fetch(`/api/tenants/${org.slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "owner",
        }),
      });

      if (!userResponse.ok) {
        const userError = await userResponse.json();
        if (!userError.error?.includes("duplicate")) {
          throw new Error("Error al crear el usuario");
        }
        // If user already exists, continue
      }

      // Then complete onboarding
      const onboardingResponse = await fetch(`/api/tenants/${org.slug}/users/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!onboardingResponse.ok) {
        throw new Error("Error al completar onboarding");
      }

      // Redirect to dashboard
      router.push(`/${org.slug}/dashboard`);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al completar el onboarding. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>¡Bienvenido, {user?.firstName || "Usuario"}!</CardTitle>
          <CardDescription>
            Tu organización ha sido creada exitosamente. ¡Estás listo para comenzar!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-center">
            <div className="text-sm text-muted-foreground">
              Tu cuenta está configurada y lista para usar.
            </div>
            
            <Button 
              onClick={handleCompleteOnboarding} 
              className="w-full" 
              disabled={loading}
            >
              {loading ? "Finalizando..." : "Continuar al Dashboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}