export const rolePermissions = {
  owner: [
    "organization:manage",
    "users:manage",
    "projects:create",
    "projects:edit:all",
    "projects:delete:all",
    "projects:view:all",
  ],
  admin: [
    "users:manage",
    "projects:create",
    "projects:edit:all",
    "projects:delete:all",
    "projects:view:all",
  ],
  member: [
    "projects:create",
    "projects:edit:own",
    "projects:delete:own",
    "projects:view:public",
    "projects:view:own",
  ],
  viewer: ["projects:view:public"],
} as const;

export type Role = keyof typeof rolePermissions;
export type Permission = (typeof rolePermissions)[Role][number];

export function hasPermission(userRole: string, permission: string): boolean {
  const role = userRole as Role;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  
  return permissions.includes(permission as never) || false;
}
