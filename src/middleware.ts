import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { TenantManager } from "@/db/config/tenant-manager";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/sign-in(.*)",
  "/auth/sign-up(.*)",
  "/api/webhooks(.*)",
]);

// Routes that require tenant context
const isTenantRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId, orgSlug } = await auth.protect();
    
    // For tenant-aware routes, handle automatic tenant detection
    if (isTenantRoute(request)) {
      // First try explicit header
      let tenantId = request.headers.get('x-tenant-id');
      
      // If no explicit header and user is authenticated, use their org slug
      if (!tenantId && userId && orgSlug) {
        tenantId = orgSlug;
      }
      
      if (tenantId) {
        const tenant = await TenantManager.getTenantBySlug(tenantId);
        if (tenant) {
          // Verify user belongs to this tenant (security check)
          if (orgSlug === tenantId) {
            const response = NextResponse.next();
            response.headers.set('x-current-tenant', tenantId);
            return response;
          }
        }
      }
      
      // If we reach here, tenant context is missing or invalid
      // Redirect to onboarding to set up tenant context
      return NextResponse.redirect(new URL('/auth/onboarding', request.url));
    }
    
    // For other protected routes, just continue
    return NextResponse.next();
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};