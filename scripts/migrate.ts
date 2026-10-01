import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const migrationUrl=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
  if(!migrationUrl)throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required');
  const sql=neon(migrationUrl);
  await sql.query('CREATE TABLE IF NOT EXISTS app_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const migrationDir=new URL('../drizzle/',import.meta.url);
  const migrations=(await readdir(migrationDir)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
  for(const migrationId of migrations.map(name=>name.replace(/\.sql$/,''))){
    const existing=await sql.query('SELECT id FROM app_migrations WHERE id = $1',[migrationId]);
    if(existing.length)continue;
    const migration=await readFile(new URL(`${migrationId}.sql`,migrationDir),'utf8');
    for(const statement of migration.split(/;\s*(?:\r?\n|$)/).map(value=>value.trim()).filter(Boolean))await sql.query(statement);
    await sql.query('INSERT INTO app_migrations (id) VALUES ($1)',[migrationId]);
    console.log(`Applied migration ${migrationId}.`);
  }
  console.log('Neon schema is ready.');
}
main().catch(error=>{console.error('Neon migration failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
