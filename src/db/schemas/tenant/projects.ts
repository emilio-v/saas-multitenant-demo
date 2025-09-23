import {
  pgTable,
  pgSchema,
  varchar,
  timestamp,
  boolean,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { users, tenantSchema } from "./users";

// Schema definition for DRY principle - shared between static and dynamic usage  
const projectsTableSchema = {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  description: text("description"),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  isPublic: boolean("is_public").default(false),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

// Static export for Drizzle Kit migration generation (uses tenant schema)
export const projects = tenantSchema.table("projects", projectsTableSchema);

// Factory function for runtime tenant creation  
export const createProjectsTable = (schemaName?: string) => {
  if (schemaName) {
    const schema = pgSchema(schemaName);
    return schema.table("projects", projectsTableSchema);
  }
  return pgTable("projects", projectsTableSchema);
};