import { NextResponse } from 'next/server';
import { equivalentUserIds, userFromRequest } from '@/lib/auth/identity';
import { findPendingFeedback, submitFeedback } from '@/lib/feedback/service';
import { apiError, unauthorized } from '@/lib/http';
import { feedbackSchema } from '@/lib/validation';

// The wash this user has not rated yet, if any.
export async function GET(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    return NextResponse.json({ pending: await findPendingFeedback(await equivalentUserIds(user.id)) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    const input = feedbackSchema.parse(await request.json());
    await submitFeedback(await equivalentUserIds(user.id), input);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
