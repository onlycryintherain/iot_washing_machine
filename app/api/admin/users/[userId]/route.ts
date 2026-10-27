import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { reminderLog, sessions, subscriptions, users, washers, washFeedback } from '@/lib/db/schema';
import { equivalentUserIds } from '@/lib/auth/identity';
import { errorCode } from '@/lib/errors';
import { apiError, requireAdmin, unauthorized } from '@/lib/http';

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  studentId: z.string().trim().max(32),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!requireAdmin(request)) return unauthorized('인증이 필요합니다.');
  try {
    const { userId } = await context.params;
    const profile = profileSchema.parse(await request.json());
    // A person may own several rows (one per browser or reinstall); edit them all so they stay one person.
    const ids = await equivalentUserIds(userId);
    const updated = await getDb().update(users)
      .set({ nickname: profile.nickname, studentId: profile.studentId || null, updatedAt: new Date() })
      .where(inArray(users.id, ids))
      .returning({ id: users.id, nickname: users.nickname, studentId: users.studentId });
    const user = updated.find((row) => row.id === userId) ?? updated[0];
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!requireAdmin(request)) return unauthorized('인증이 필요합니다.');
  try {
    const { userId } = await context.params;
    const db = getDb();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    const ids = await equivalentUserIds(userId);
    const [assigned] = await db.select({ id: washers.id }).from(washers).where(inArray(washers.currentUserId, ids)).limit(1);
    if (assigned) return NextResponse.json({ error: '현재 세탁기에 연결된 사용자입니다. 수거 완료 또는 초기화 후 삭제해주세요.' }, { status: 409 });

    const deleted = await db.transaction(async (tx) => {
      await tx.delete(washFeedback).where(inArray(washFeedback.userId, ids));
      await tx.delete(reminderLog).where(inArray(reminderLog.sessionId, tx.select({ id: sessions.id }).from(sessions).where(inArray(sessions.userId, ids))));
      await tx.delete(sessions).where(inArray(sessions.userId, ids));
      await tx.delete(subscriptions).where(inArray(subscriptions.userId, ids));
      return tx.delete(users).where(inArray(users.id, ids)).returning({ id: users.id });
    });
    if (!deleted.length) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (errorCode(error) === '23503') {
      return NextResponse.json({ error: '현재 사용 중인 세탁기가 있어 삭제할 수 없습니다. 상태를 갱신한 뒤 다시 시도해주세요.' }, { status: 409 });
    }
    return apiError(error);
  }
}
