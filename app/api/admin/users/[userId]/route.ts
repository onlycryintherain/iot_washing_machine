import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
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
