import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Scripts (seed, scenario) run outside Next: pick up .env.local ourselves.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
}

const g = globalThis as unknown as { __pool?: Pool };
const url = process.env.DATABASE_URL ?? "";

export const pool =
  g.__pool ??
  new Pool({
    connectionString: url,
    max: 5,
    ssl: url.includes("localhost") || !url ? undefined : { rejectUnauthorized: false },
  });
g.__pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
