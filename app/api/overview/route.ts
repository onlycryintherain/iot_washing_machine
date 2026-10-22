import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/auth/identity';
import { apiError, unauthorized } from '@/lib/http';
import { loadOverview } from '@/lib/stats/service';

export async function GET(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    return NextResponse.json(await loadOverview());
  } catch (error) {
    return apiError(error);
  }
}
