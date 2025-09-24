# Tenant Routing Migration: Path-based to Header-based

This document compares two approaches for migrating from the current path-based tenant routing (`/[tenant]/dashboard`) to cleaner URLs without tenant slugs in the path.

## Current Implementation

**Route Structure**: `/[tenant]/dashboard`, `/[tenant]/projects`
**Tenant Detection**: URL path parameter (`params.tenant`)
**Examples**: 
- `localhost:3000/acme/dashboard`
- `localhost:3000/test-corp/projects`

## Migration Options

### Option A: Subdomain-based Routing

**URL Structure**: `tenant.localhost:3000/dashboard`
**Tenant Detection**: Extract from subdomain via middleware
**Examples**:
- `acme.localhost:3000/dashboard`
- `test-corp.localhost:3000/projects`

#### Implementation Approach
```typescript
// middleware.ts
const hostname = request.headers.get('host') || url.hostname
const subdomain = hostname.split('.')[0]
response.headers.set('x-tenant', subdomain)
```

#### Pros
✅ **Professional appearance**: Subdomains feel more enterprise-like  
✅ **True tenant isolation**: Each tenant has own "domain"  
✅ **SEO benefits**: Search engines treat subdomains as separate sites  
✅ **Branding opportunity**: Custom subdomain per tenant  

#### Cons
❌ **Complex local development**: Need wildcard DNS setup (`*.localhost`)  
❌ **SSL certificate complexity**: Wildcard SSL required in production  
❌ **Deployment complexity**: Vercel wildcard domain configuration  
❌ **Limited subdomain availability**: Name conflicts possible  

#### Development Setup Required
- DNS configuration for `*.localhost`
- Hosts file modification or local DNS server
- More complex development environment setup

#### Production Requirements
- Wildcard domain (`*.yourdomain.com`)
- Wildcard SSL certificate
- Vercel/Cloudflare subdomain routing configuration

---

### Option B: Header-based Routing (Recommended)

**URL Structure**: `localhost:3000/dashboard`
**Tenant Detection**: Custom header `x-tenant-id`
**Examples**:
- `localhost:3000/dashboard` + `x-tenant-id: acme`
- `localhost:3000/projects` + `x-tenant-id: test-corp`

#### Implementation Approach
```typescript
// middleware.ts
const tenantId = request.headers.get('x-tenant-id')
if (tenantId) {
  response.headers.set('x-current-tenant', tenantId)
}
```

#### Pros
✅ **Simple development**: No DNS/subdomain configuration needed  
✅ **Easy deployment**: No wildcard domain requirements  
✅ **Flexible**: Can switch tenant context dynamically  
✅ **Clean URLs**: `/dashboard` instead of `/tenant/dashboard`  
✅ **No naming conflicts**: Header values can be any valid tenant ID  
✅ **API consistency**: Matches RESTful API patterns  

#### Cons
❌ **Requires client-side tenant management**: Must set header on requests  
❌ **Less intuitive**: URL doesn't show current tenant context  
❌ **SEO neutral**: No inherent SEO benefits like subdomains  

#### Implementation Simplicity
- Middleware modification only
- Move route files from `[tenant]/` to root app directory
- Update tenant detection utilities
- Client-side header management

---

## Technical Implementation Comparison

### Option A: Subdomain Implementation

**Middleware Changes**:
```typescript
export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || request.nextUrl.hostname
  const parts = hostname.split('.')
  
  if (parts.length >= 2 && parts[0] !== 'www') {
    const subdomain = parts[0]
    const tenant = await TenantManager.getTenantBySlug(subdomain)
    
    if (!tenant && !isPublicRoute(request)) {
      return NextResponse.redirect(new URL('/auth/onboarding', request.url))
    }
    
    const response = NextResponse.next()
    response.headers.set('x-tenant', subdomain)
    return response
  }
  
  // Handle www or no subdomain
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
  return NextResponse.next()
})
```

**Route Structure**:
```
src/app/
├── dashboard/page.tsx          # acme.localhost:3000/dashboard
├── projects/page.tsx           # acme.localhost:3000/projects
├── api/                        # API routes remain unchanged
└── layout.tsx                  # Root layout with tenant context
```

### Option B: Header-based Implementation

**Middleware Changes**:
```typescript
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
    
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
  
  return NextResponse.next()
})
```

**Route Structure**:
```
src/app/
├── dashboard/page.tsx          # localhost:3000/dashboard + header
├── projects/page.tsx           # localhost:3000/projects + header
├── api/                        # API routes remain unchanged
└── (tenant)/                   # Route group for tenant-aware pages
    ├── layout.tsx              # Tenant context provider
    ├── dashboard/page.tsx
    └── projects/page.tsx
```

**Tenant Context Utility**:
```typescript
// src/lib/tenant-context.ts
import { headers } from 'next/headers'

export async function getCurrentTenant(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-current-tenant')
}
```

## Client-Side Implementation

### Option A: Subdomain
```typescript
// Automatic - tenant is in URL
// No client-side changes needed
const currentUrl = window.location.hostname // acme.localhost
const tenant = currentUrl.split('.')[0]     // acme
```

### Option B: Header-based
```typescript
// Client must manage tenant context
// Could use localStorage, context, or state management

// Set header on API calls
fetch('/api/tenants/projects', {
  headers: {
    'x-tenant-id': currentTenant
  }
})

// React context for tenant
const TenantContext = createContext<string | null>(null)
```

## Migration Path Analysis

### Option A Migration Steps
1. **DNS Setup**: Configure wildcard DNS for development
2. **Middleware Update**: Add subdomain extraction logic
3. **Route Migration**: Move files from `[tenant]/` to root
4. **Layout Updates**: Remove tenant params, use subdomain context
5. **Navigation Updates**: Change all links to exclude tenant path
6. **Production Setup**: Configure wildcard domain and SSL
7. **Testing**: Test across multiple subdomains

### Option B Migration Steps
1. **Middleware Update**: Add header-based tenant detection
2. **Route Migration**: Move files from `[tenant]/` to root or route group
3. **Tenant Utility**: Create header-based tenant context helper
4. **Layout Updates**: Replace params with header-based detection
5. **Client Updates**: Add tenant header management
6. **Navigation Updates**: Remove tenant from URLs
7. **Testing**: Test with different header values

## Recommendation: Option B (Header-based)

**Reasons for Recommendation**:

1. **Development Simplicity**: No complex DNS or subdomain configuration needed
2. **Deployment Simplicity**: Works with standard Vercel deployment, no wildcard domains
3. **Flexibility**: Easy to switch between tenants for testing or admin purposes
4. **Maintenance**: Simpler codebase without subdomain complexity
5. **Cost**: No additional SSL certificate or domain configuration costs
6. **Debug-friendly**: Easy to test different tenants by changing header value

**Implementation Priority**: Medium complexity, can be done incrementally

**Next Steps**:
1. Implement header-based middleware
2. Create tenant context utility
3. Migrate dashboard route as proof of concept
4. Update navigation and layouts
5. Test thoroughly before migrating other routes

---

## Conclusion

While **Option A (Subdomain-based)** provides a more professional appearance and better tenant isolation, **Option B (Header-based)** offers significantly better development experience, simpler deployment, and easier maintenance.

For a development-focused multi-tenant demo, **Option B is recommended** as it maintains clean URLs while avoiding the complexity of wildcard subdomain management.