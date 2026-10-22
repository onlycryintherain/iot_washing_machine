import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError, describeError } from '@/lib/errors';


export function apiError(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  if (error instanceof Error && error.message.endsWith('is not configured')) {
    console.error(error.message);
    return NextResponse.json({ error: '서버 설정이 완료되지 않았습니다.' }, { status: 503 });
  }
  console.error('Unhandled API error', describeError(error));
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
}

export function safeEqual(actual: string | null | undefined, expected: string | null | undefined) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireBearer(request: Request, secret: string | undefined) {
  return safeEqual(request.headers.get('authorization'), secret && `Bearer ${secret}`);
}

export function requireAdmin(request: Request) {
  return safeEqual(request.headers.get('x-admin-password'), process.env.ADMIN_PASSWORD);
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}
