// Plain Node script so it runs unchanged on a dev machine and inside the production image.
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const washerSeed = [['1', '1번 세탁기'], ['2', '2번 세탁기']];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const dir = new URL('../drizzle/', import.meta.url);
    const migrations = (await readdir(dir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    for (const file of migrations) {
      const id = file.replace(/\.sql$/, '');
      if ((await client.query('SELECT 1 FROM app_migrations WHERE id = $1', [id])).rowCount) continue;
      const sql = await readFile(new URL(file, dir), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO app_migrations (id) VALUES ($1)', [id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      console.log(`Applied migration ${id}.`);
    }
    if (process.argv.includes('--seed')) {
      for (const [id, name] of washerSeed) {
        await client.query('INSERT INTO washers (id, name, location) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, name, '기숙사 세탁실']);
      }
      console.log('Seeded washers 1 and 2.');
    }
    console.log('Database schema is ready.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
