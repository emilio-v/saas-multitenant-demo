"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/contexts/tenant-provider";

interface TenantAwareLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  fallbackToPath?: boolean; // If true, falls back to path-based routing when headers not supported
}

export function TenantAwareLink({ 
  href, 
  children, 
  className, 
  fallbackToPath = true 
}: TenantAwareLinkProps) {
  const { tenantSlug, isLoading } = useTenant();
  const router = useRouter();

  // For server-side navigation (when JavaScript is disabled or initial load)
  // we can fall back to path-based routing
  const fallbackHref = fallbackToPath && tenantSlug ? `/${tenantSlug}${href}` : href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    if (isLoading) return;
    
    if (!tenantSlug) {
      // No tenant context, redirect to onboarding
      router.push("/auth/onboarding");
      return;
    }

    // Use header-based navigation with programmatic routing
    // This ensures the x-tenant-id header will be set by our context
    router.push(href);
  };

  return (
    <Link 
      href={fallbackHref} 
      className={className} 
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

// Hook for programmatic navigation with tenant context
export function useTenantRouter() {
  const { tenantSlug, isLoading } = useTenant();
  const router = useRouter();

  const push = (href: string) => {
    if (isLoading) return;
    
    if (!tenantSlug) {
      router.push("/auth/onboarding");
      return;
    }

    router.push(href);
  };

  const replace = (href: string) => {
    if (isLoading) return;
    
    if (!tenantSlug) {
      router.replace("/auth/onboarding");
      return;
    }

    router.replace(href);
  };

  return { push, replace, tenantSlug, isLoading };
}