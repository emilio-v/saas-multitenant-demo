import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { TenantManager } from "@/db/config/tenant-manager";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/sign-in(.*)",
  "/auth/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
    
    // Extract tenant from header for protected routes
    const tenantId = request.headers.get('x-tenant-id')
    if (tenantId) {
      const tenant = await TenantManager.getTenantBySlug(tenantId)
      if (tenant) {
        const response = NextResponse.next()
        response.headers.set('x-current-tenant', tenantId)
        return response
      }
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};