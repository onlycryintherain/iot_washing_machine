import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { reminderLog, sessions, subscriptions, users, washers } from '@/lib/db/schema';
import { apiError } from '@/lib/http';

const profileSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  studentId: z.string().trim().max(32),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!process.env.ADMIN_PASSWORD || request.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  try {
    const { userId } = await context.params;
    const profile = profileSchema.parse(await request.json());
    const [user] = await getDb().update(users)
      .set({ nickname: profile.nickname, studentId: profile.studentId || null, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, nickname: users.nickname, studentId: users.studentId });
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!process.env.ADMIN_PASSWORD || request.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  try {
    const { userId } = await context.params;
    const db = getDb();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    const [assigned] = await db.select({ id: washers.id }).from(washers).where(eq(washers.currentUserId, userId)).limit(1);
    if (assigned) return NextResponse.json({ error: '현재 세탁기에 연결된 사용자입니다. 수거 완료 또는 초기화 후 삭제해주세요.' }, { status: 409 });

    // Neon HTTP batch runs these dependent deletes in one database transaction.
    const [, , , deleted] = await db.batch([
      db.delete(reminderLog).where(inArray(reminderLog.sessionId, db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId)))),
      db.delete(sessions).where(eq(sessions.userId, userId)),
      db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
      db.delete(users).where(eq(users.id, userId)).returning({ id: users.id }),
    ]);
    if (!deleted.length) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
      return NextResponse.json({ error: '현재 사용 중인 세탁기가 있어 삭제할 수 없습니다. 상태를 갱신한 뒤 다시 시도해주세요.' }, { status: 409 });
    }
    return apiError(error);
  }
}
