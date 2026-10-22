import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth/identity';
import { apiError, unauthorized } from '@/lib/http';
import { loadWasherEvents } from '@/lib/stats/service';

export async function GET(request: Request, { params }: { params: Promise<{ washerId: string }> }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    const { washerId } = await params;
    return NextResponse.json({ events: await loadWasherEvents(washerId) });
  } catch (error) {
    return apiError(error);
  }
}
