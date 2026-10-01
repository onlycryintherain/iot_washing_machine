import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createUser, userFromRequest } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { onboardingSchema } from '@/lib/validation';
import { apiError } from '@/lib/http';

export async function POST(request: Request) {
  try {
    const { nickname, studentId } = onboardingSchema.parse(await request.json());
    const existing = await userFromRequest(request);
    if (existing) {
      const [user] = await getDb().update(users)
        .set({ nickname, studentId, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning({ id: users.id, nickname: users.nickname, userCode: users.userCode });
      return NextResponse.json({ user, profileComplete: true });
    }
    return NextResponse.json(await createUser(nickname, studentId), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
