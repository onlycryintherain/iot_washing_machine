import { NextResponse } from 'next/server';
import { loadFeedbackSummary } from '@/lib/feedback/service';
import { apiError, requireAdmin, unauthorized } from '@/lib/http';

export async function GET(request: Request) {
  if (!requireAdmin(request)) return unauthorized('인증이 필요합니다.');
  try {
    return NextResponse.json(await loadFeedbackSummary(), { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
