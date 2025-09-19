import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql);

const tenantConnections = new Map<string, postgres.Sql>();

export function getTenantDb(schemaName: string) {
  if (!tenantConnections.has(schemaName)) {
    const tenantSql = postgres(process.env.DATABASE_URL!, {
      connection: {
        search_path: schemaName,
      },
    });
    tenantConnections.set(schemaName, tenantSql);
  }

  const sql = tenantConnections.get(schemaName)!;
  return drizzle(sql);
}

export async function closeTenantConnections() {
  for (const [_, connection] of tenantConnections) {
    await connection.end();
  }
  tenantConnections.clear();
}
