// Optional: fills the database with synthetic usage history so the charts look alive in a showcase.
//   node scripts/seed-demo.mjs          add ~70 demo sessions spread over the last 30 days
//   node scripts/seed-demo.mjs --clean  remove everything this script created
// Demo rows belong to a user whose nickname starts with "[데모]"; real data is never touched.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const NICKNAME = '[데모] 이용 기록';
// Relative weight of each Korean hour; dorms peak in the evening.
const weights = [0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 2, 2, 3, 4, 5, 4, 3, 3, 5, 7, 9, 12, 10, 4];
const CYCLE_MS = 12_000;

function pickHour() {
  let roll = Math.random() * weights.reduce((sum, value) => sum + value, 0);
  for (let hour = 0; hour < 24; hour++) { roll -= weights[hour]; if (roll < 0) return hour; }
  return 21;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE nickname = $1', [NICKNAME]);
    if (existing.rowCount) {
      const ids = existing.rows.map((row) => row.id);
      await client.query('DELETE FROM reminder_log WHERE session_id IN (SELECT id FROM laundry_sessions WHERE user_id = ANY($1))', [ids]);
      await client.query('DELETE FROM laundry_sessions WHERE user_id = ANY($1)', [ids]);
      await client.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
      console.log('Removed previous demo data.');
    }
    if (process.argv.includes('--clean')) return;

    const washers = (await client.query('SELECT id FROM washers ORDER BY id')).rows.map((row) => row.id);
    if (!washers.length) throw new Error('No washers found. Run the migration first.');
    const userId = randomUUID();
    const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await client.query('INSERT INTO users (id, nickname, user_code, token_hash) VALUES ($1, $2, $3, $4)', [userId, NICKNAME, String(Math.floor(1000 + Math.random() * 9000)), tokenHash]);

    const now = Date.now();
    let inserted = 0;
    for (let day = 1; day <= 30; day++) {
      const perDay = 1 + Math.floor(Math.random() * 4);
      for (let n = 0; n < perDay; n++) {
        const kstDay = new Date(now - day * 86_400_000 + 9 * 3600_000);
        const start = Date.UTC(kstDay.getUTCFullYear(), kstDay.getUTCMonth(), kstDay.getUTCDate(), pickHour() - 9, Math.floor(Math.random() * 60));
        const finish = start + CYCLE_MS + Math.floor((Math.random() - 0.5) * 2000);
        await client.query(
          `INSERT INTO laundry_sessions (id, washer_id, user_id, status, reserved_at, started_at, finished_at, picked_up_at, finished_notification_sent_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'PICKED_UP', $4, $5, $6, $7, $6, $4, $7)`,
          [randomUUID(), washers[Math.floor(Math.random() * washers.length)], userId, new Date(start - 60_000), new Date(start), new Date(finish), new Date(finish + 5 * 60_000)],
        );
        inserted++;
      }
    }
    console.log(`Added ${inserted} demo sessions. Remove them with: node scripts/seed-demo.mjs --clean`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
