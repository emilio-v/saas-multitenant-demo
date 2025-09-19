import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const createProjectsTable = (schemaName: string) => {
  return pgTable(`${schemaName}.projects`, {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    description: text("description"),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    isPublic: boolean("is_public").default(false),
    status: varchar("status", { length: 50 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  });
};