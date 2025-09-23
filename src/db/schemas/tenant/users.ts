import {
  pgTable,
  pgSchema,
  varchar,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

// Create a tenant schema for migration generation (using generic "tenant" schema)
export const tenantSchema = pgSchema("tenant");

// Schema definition for DRY principle - shared between static and dynamic usage
const usersTableSchema = {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  phone: varchar("phone", { length: 50 }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  metadata: jsonb("metadata").default("{}").notNull(),
  isActive: boolean("is_active").default(true),
  lastSeenAt: timestamp("last_seen_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

// Static export for Drizzle Kit migration generation (uses tenant schema)
export const users = tenantSchema.table("users", usersTableSchema);

// Factory function for runtime tenant creation
export const createUsersTable = (schemaName?: string) => {
  if (schemaName) {
    const schema = pgSchema(schemaName);
    return schema.table("users", usersTableSchema);
  }
  return pgTable("users", usersTableSchema);
};
