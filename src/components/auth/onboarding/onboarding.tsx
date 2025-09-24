"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
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

  const handleCompleteOnboarding = async () => {
    if (!userMemberships?.data || userMemberships.data.length === 0) {
      return;
    }

    const org = userMemberships.data[0].organization;
    
    try {
      // Complete onboarding by updating the metadata
      const onboardingResponse = await fetch(`/api/tenants/${org.slug}/users/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!onboardingResponse.ok) {
        throw new Error("Error completing onboarding");
      }

      // Redirect to header-based dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      alert("Error completing onboarding. Please try again.");
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
            >
              Continuar al Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}