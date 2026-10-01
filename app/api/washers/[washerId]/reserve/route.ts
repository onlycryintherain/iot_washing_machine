import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth/identity';
import { reserveWasher } from '@/lib/washer/service';
import { apiError } from '@/lib/http';

export async function POST(request: Request, { params }: { params: Promise<{ washerId: string }> }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: '사용자 정보를 다시 등록해주세요.' }, { status: 401 });
    const { washerId } = await params;
    return NextResponse.json({ washer: await reserveWasher(washerId, user.id), user });
  } catch (error) {
    return apiError(error);
  }
}
