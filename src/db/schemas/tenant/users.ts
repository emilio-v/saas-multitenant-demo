import { pgTable, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const createUsersTable = (schemaName: string) => {
  return pgTable("users", {
    id: varchar("id", { length: 255 }).primaryKey(), // clerk_user_id
    email: varchar("email", { length: 255 }).unique().notNull(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    role: varchar("role", { length: 50 }).default("member").notNull(),
    metadata: jsonb("metadata").default("{}").notNull(),
    isActive: boolean("is_active").default(true),
    lastSeenAt: timestamp("last_seen_at"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  });
};