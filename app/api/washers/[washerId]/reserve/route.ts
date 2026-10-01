import { NextResponse } from 'next/server';
import { userFromRequest, createUser } from '@/lib/auth/identity';
import { reserveSchema } from '@/lib/validation';
import { reserveWasher } from '@/lib/washer/service';
import { apiError } from '@/lib/http';
export async function POST(request:Request,{params}:{params:Promise<{washerId:string}>}) { try { const existing=await userFromRequest(request); const body=reserveSchema.parse(await request.json()); const {washerId}=await params; if(!existing){if(!body.nickname)return NextResponse.json({error:'닉네임을 입력해주세요.'},{status:400});const created=await createUser(body.nickname);const washer=await reserveWasher(washerId,created.user.id);return NextResponse.json({washer,user:created.user,token:created.token},{status:201});}const washer=await reserveWasher(washerId,existing.id);return NextResponse.json({washer,user:existing}); } catch(e) { return apiError(e); } }
