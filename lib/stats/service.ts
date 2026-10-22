import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { equivalentUserIds } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { events, sessions, washers } from '@/lib/db/schema';
import { OVERVIEW_DAYS, hourlyCounts, historyMinutes, summarizeToday } from './overview';

const COUNTED = ['RUNNING', 'FINISHED', 'PICKED_UP'] as const;

export async function loadOverview(userId: string, now = Date.now()) {
  const db = getDb();
  const since = new Date(now - OVERVIEW_DAYS * 86_400_000);
  const rows = await db.select({ startedAt: sessions.startedAt, finishedAt: sessions.finishedAt }).from(sessions)
    .where(and(isNotNull(sessions.startedAt), gte(sessions.startedAt, since), inArray(sessions.status, [...COUNTED]))).limit(5000);
  const times = rows.flatMap((row) => (row.startedAt ? [{ startedAt: row.startedAt, finishedAt: row.finishedAt }] : []));
  const owners = await equivalentUserIds(userId);
  const mine = await db.select({ id: sessions.id, washerName: washers.name, startedAt: sessions.startedAt, finishedAt: sessions.finishedAt }).from(sessions)
    .innerJoin(washers, eq(washers.id, sessions.washerId))
    .where(and(inArray(sessions.userId, owners), isNotNull(sessions.startedAt), inArray(sessions.status, [...COUNTED]))).orderBy(desc(sessions.startedAt)).limit(5);
  return {
    today: summarizeToday(times, now),
    hourly: hourlyCounts(times.map((time) => time.startedAt)),
    totalSessions: times.length,
    history: mine.flatMap((row) => (row.startedAt ? [{ id: row.id, washerName: row.washerName, startedAt: row.startedAt.toISOString(), minutes: historyMinutes({ startedAt: row.startedAt, finishedAt: row.finishedAt }) }] : [])),
  };
}

export async function loadWasherEvents(washerId: string, limit = 8) {
  const rows = await getDb().select({ id: events.id, type: events.type, vibration: events.vibration, current: events.current, doorOpen: events.doorOpen, createdAt: events.createdAt })
    .from(events).where(eq(events.washerId, washerId)).orderBy(desc(events.createdAt)).limit(limit);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
