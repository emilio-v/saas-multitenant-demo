import { headers } from 'next/headers'
import { TenantManager } from '@/db/config/tenant-manager'

export async function getCurrentTenant(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-current-tenant')
}

export async function getCurrentTenantRecord() {
  const tenantSlug = await getCurrentTenant()
  if (!tenantSlug) return null
  
  return await TenantManager.getTenantBySlug(tenantSlug)
}

export async function requireCurrentTenant(): Promise<string> {
  const tenant = await getCurrentTenant()
  if (!tenant) {
    throw new Error('Tenant context required but not found')
  }
  return tenant
}

export async function requireCurrentTenantRecord() {
  const tenantRecord = await getCurrentTenantRecord()
  if (!tenantRecord) {
    throw new Error('Tenant record required but not found')
  }
  return tenantRecord
}