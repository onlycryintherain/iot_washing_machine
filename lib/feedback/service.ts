import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { sessions, washers, washFeedback } from '@/lib/db/schema';
import { HttpError } from '@/lib/errors';
import { FEEDBACK_WINDOW_DAYS, summarizeFeedback } from './summary';

// A wash can be rated for two days after it was picked up.
const RATE_WITHIN_MS = 48 * 3_600_000;

export async function findPendingFeedback(userIds: string[], now = Date.now()) {
  const [row] = await getDb()
    .select({ sessionId: sessions.id, washerId: sessions.washerId, washerName: washers.name, finishedAt: sessions.finishedAt })
    .from(sessions)
    .innerJoin(washers, eq(washers.id, sessions.washerId))
    .leftJoin(washFeedback, eq(washFeedback.sessionId, sessions.id))
    .where(and(inArray(sessions.userId, userIds), eq(sessions.status, 'PICKED_UP'), gte(sessions.pickedUpAt, new Date(now - RATE_WITHIN_MS)), isNull(washFeedback.id)))
    .orderBy(desc(sessions.pickedUpAt))
    .limit(1);
  return row ? { ...row, finishedAt: row.finishedAt?.toISOString() ?? null } : null;
}

export async function submitFeedback(userIds: string[], input: { sessionId: string; rating: number; issues: string[]; comment?: string }, now = new Date()) {
  const db = getDb();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, input.sessionId)).limit(1);
  if (!session || !userIds.includes(session.userId)) throw new HttpError(403, '내 세탁만 평가할 수 있어요.');
  if (session.status !== 'PICKED_UP' || !session.pickedUpAt || now.getTime() - session.pickedUpAt.getTime() > RATE_WITHIN_MS) throw new HttpError(409, '이 세탁은 지금 평가할 수 없어요.');
  const [saved] = await db.insert(washFeedback)
    .values({ id: randomUUID(), sessionId: session.id, washerId: session.washerId, userId: session.userId, rating: input.rating, issues: [...new Set(input.issues)], comment: input.comment || null, createdAt: now })
    .onConflictDoNothing()
    .returning({ id: washFeedback.id });
  if (!saved) throw new HttpError(409, '이미 평가한 세탁이에요.');
  return saved;
}

// No user ids leave this function: admins see machines, not people.
export async function loadFeedbackSummary(now = Date.now()) {
  const db = getDb();
  const since = new Date(now - FEEDBACK_WINDOW_DAYS * 86_400_000);
  const [machines, rows] = await Promise.all([
    db.select({ id: washers.id, name: washers.name }).from(washers).orderBy(washers.id),
    db.select({ washerId: washFeedback.washerId, rating: washFeedback.rating, issues: washFeedback.issues, comment: washFeedback.comment, createdAt: washFeedback.createdAt })
      .from(washFeedback).where(gte(washFeedback.createdAt, since)).orderBy(desc(washFeedback.createdAt)).limit(2000),
  ]);
  const recent = rows.filter((row) => row.comment).slice(0, 10).map((row) => ({ washerId: row.washerId, rating: row.rating, issues: row.issues, comment: row.comment, createdAt: row.createdAt.toISOString() }));
  return { windowDays: FEEDBACK_WINDOW_DAYS, washers: summarizeFeedback(machines, rows, now), recent };
}
