import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { userFromRequest } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { apiError, unauthorized } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    const [row] = await getDb().select({ nickname: users.nickname, studentId: users.studentId }).from(users).where(eq(users.id, user.id)).limit(1);
    return NextResponse.json({ nickname: row?.nickname ?? user.nickname, studentId: row?.studentId ?? null });
  } catch (error) {
    return apiError(error);
  }
}
