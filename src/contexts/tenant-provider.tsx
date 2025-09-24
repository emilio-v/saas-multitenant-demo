"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';

interface TenantContextType {
  tenantSlug: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoaded && orgLoaded) {
      if (isSignedIn && organization?.slug) {
        setTenantSlug(organization.slug);
      } else {
        setTenantSlug(null);
      }
      setIsLoading(false);
    }
  }, [isSignedIn, organization, authLoaded, orgLoaded]);

  return (
    <TenantContext.Provider value={{ tenantSlug, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === null) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}