import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  instance ??= drizzle(neon(process.env.DATABASE_URL), { schema });
  return instance;
}
