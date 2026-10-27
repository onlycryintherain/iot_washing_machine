// Optional: fills the database with synthetic usage history so the charts look alive in a showcase.
//   node scripts/seed-demo.mjs          add roughly 80 demo sessions spread over the last 30 days (including today)
//   node scripts/seed-demo.mjs --clean  remove everything this script created
// Each demo wash also gets a satisfaction answer (last 14 days only).
// Demo rows belong to a user whose nickname starts with "[데모]"; real data is never touched.
//
// The history follows the dorm's rules so it reads as realistic: nobody can enter in the morning,
// the dorm opens at 17:30 on Wednesdays and at 20:20 on every other day (all times Korea time).
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const NICKNAME = '[데모] 이용 기록';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;
const h = (hours, minutes = 0) => hours * 60 + minutes;

// [from, to, weight] in minutes after midnight.
const WINDOWS = {
  wednesday: [[h(17, 30), h(18, 30), 3], [h(18, 30), h(20), 4], [h(20), h(21, 30), 6], [h(21, 30), h(22, 45), 3]],
  other: [[h(20, 20), h(21), 5], [h(21), h(22), 7], [h(22), h(23), 4]],
};
const LAST_START = h(23, 10);
// Sessions per day by weekday (0 = Sunday): busy when students return on Sunday and on Wednesday, quiet when many go home.
const PER_DAY = { 0: [3, 6], 1: [2, 4], 2: [2, 4], 3: [3, 6], 4: [2, 4], 5: [1, 3], 6: [1, 3] };
const DISPLAY_CYCLE_MIN = 50; // the app shows a cycle as ~48 minutes; keep a washer busy that long
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function pickMinute(windows) {
  let roll = Math.random() * windows.reduce((sum, [, , weight]) => sum + weight, 0);
  for (const [from, to, weight] of windows) {
    roll -= weight;
    if (roll < 0) return between(from, to - 1);
  }
  const [from, to] = windows[windows.length - 1];
  return between(from, to - 1);
}

// The last washer plays the one with a clogged filter: lint on clothes shows up in many answers, so the admin screen has something to flag.
function fakeFeedback(worn) {
  if (worn && Math.random() < 0.45) return { rating: between(1, 3), issues: Math.random() < 0.7 ? ['RESIDUE'] : ['RESIDUE', 'DAMP'] };
  if (Math.random() < 0.1) return { rating: between(2, 3), issues: [['ODOR', 'STAIN', 'NOISE'][between(0, 2)]] };
  return { rating: between(4, 5), issues: [] };
}

function planDay(weekday, washerIds) {
  const windows = weekday === 3 ? WINDOWS.wednesday : WINDOWS.other;
  const [min, max] = PER_DAY[weekday];
  const starts = Array.from({ length: between(min, max) }, () => pickMinute(windows)).sort((a, b) => a - b);
  const freeAt = new Map(washerIds.map((id) => [id, 0]));
  const plan = [];
  for (let start of starts) {
    // Two machines only: wait for the first one that is free instead of overlapping a running cycle.
    const [washerId, free] = [...freeAt].sort((a, b) => a[1] - b[1])[0];
    start = Math.max(start, free);
    if (start > LAST_START) continue;
    freeAt.set(washerId, start + DISPLAY_CYCLE_MIN);
    plan.push({ washerId, start });
  }
  return plan;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE nickname = $1', [NICKNAME]);
    if (existing.rowCount) {
      const ids = existing.rows.map((row) => row.id);
      await client.query('DELETE FROM wash_feedback WHERE user_id = ANY($1)', [ids]);
      await client.query('DELETE FROM reminder_log WHERE session_id IN (SELECT id FROM laundry_sessions WHERE user_id = ANY($1))', [ids]);
      await client.query('DELETE FROM laundry_sessions WHERE user_id = ANY($1)', [ids]);
      await client.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
      console.log('Removed previous demo data.');
    }
    if (process.argv.includes('--clean')) return;

    const washerIds = (await client.query("SELECT id FROM washers WHERE state <> 'OUT_OF_ORDER' ORDER BY id")).rows.map((row) => row.id);
    if (!washerIds.length) throw new Error('No washers found. Run the migration first.');
    const userId = randomUUID();
    const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await client.query('INSERT INTO users (id, nickname, user_code, token_hash) VALUES ($1, $2, $3, $4)', [userId, NICKNAME, String(between(1000, 9999)), tokenHash]);

    const now = Date.now();
    const todayStart = Math.floor((now + KST) / DAY) * DAY - KST; // UTC ms of today's KST midnight
    let inserted = 0;
    for (let day = 0; day <= 30; day++) {
      const midnight = todayStart - day * DAY;
      const weekday = new Date(midnight + KST).getUTCDay();
      for (const { washerId, start: minute } of planDay(weekday, washerIds)) {
        const start = midnight + minute * 60_000 + between(0, 59) * 1000;
        if (start > now - 60_000) continue; // nothing in the future
        const finish = start + between(11_500, 13_000); // the app scales ~12 s to a ~48 minute cycle
        const reserved = start - between(60, 240) * 1000;
        const pickedUp = finish + between(2, 25) * 60_000;
        const sessionId = randomUUID();
        await client.query(
          `INSERT INTO laundry_sessions (id, washer_id, user_id, status, reserved_at, started_at, finished_at, picked_up_at, finished_notification_sent_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'PICKED_UP', $4, $5, $6, $7, $6, $4, $7)`,
          [sessionId, washerId, userId, new Date(reserved), new Date(start), new Date(finish), new Date(pickedUp)],
        );
        inserted++;
        if (day <= 13 && Math.random() < 0.7) {
          const { rating, issues } = fakeFeedback(washerId === washerIds[washerIds.length - 1]);
          await client.query(
            'INSERT INTO wash_feedback (id, session_id, washer_id, user_id, rating, issues, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [randomUUID(), sessionId, washerId, userId, rating, JSON.stringify(issues), new Date(pickedUp + between(1, 20) * 60_000)],
          );
        }
      }
    }
    console.log(`Added ${inserted} demo sessions. Remove them with: node scripts/seed-demo.mjs --clean`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error('Demo seed failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1; });
