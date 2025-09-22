import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/auth/onboarding";

export default async function OnboardingPage() {
  const { userId } = await auth();
  
  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect("/auth/sign-in");
  }

  return <Onboarding />;
}