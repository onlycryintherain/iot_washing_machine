import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantIntents, matchIntent, suggestedQuestions, unknownReply } from '@/lib/assistant/answers';
import { answerIntent } from '@/lib/assistant/service';
import { userFromRequest } from '@/lib/auth/identity';
import { apiError, unauthorized } from '@/lib/http';

const requestSchema = z.object({
  intent: z.enum(assistantIntents).optional(),
  text: z.string().trim().min(1).max(200).optional(),
}).refine((value) => value.intent || value.text);

export async function POST(request: Request) {
  try {
    const user = await userFromRequest(request);
    if (!user) return unauthorized('사용자 정보를 다시 등록해주세요.');
    const data = requestSchema.parse(await request.json());
    const intent = data.intent ?? (data.text ? matchIntent(data.text) : null);
    if (!intent) return NextResponse.json({ intent: null, reply: unknownReply, suggestions: suggestedQuestions });
    return NextResponse.json({ intent, reply: await answerIntent(intent, user.id) });
  } catch (error) {
    return apiError(error);
  }
}
