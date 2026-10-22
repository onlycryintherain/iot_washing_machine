import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool?: Pool; db?: ReturnType<typeof createDb> };

function createDb(connectionString: string) {
  const pool = (globalForDb.pool ??= new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 }));
  // An idle client dropped by the server must not crash the process.
  pool.on('error', (error) => console.error('Postgres pool error', error.message));
  return drizzle(pool, { schema });
}

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return (globalForDb.db ??= createDb(process.env.DATABASE_URL));
}
