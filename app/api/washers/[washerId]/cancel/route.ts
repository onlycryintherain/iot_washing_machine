import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { equivalentUserIds, userFromRequest } from '@/lib/auth/identity';
import { getDb } from '@/lib/db';
import { washers } from '@/lib/db/schema';
import { cancelReservation } from '@/lib/washer/service';
import { apiError } from '@/lib/http';

export async function POST(request:Request,{params}:{params:Promise<{washerId:string}>}){
  try{
    const user=await userFromRequest(request);
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
    const {washerId}=await params;
    const [washer]=await getDb().select().from(washers).where(eq(washers.id,washerId)).limit(1);
    if(!washer?.currentUserId||!(await equivalentUserIds(user.id)).includes(washer.currentUserId))return NextResponse.json({error:'Not your washer'},{status:403});
    return NextResponse.json({washer:await cancelReservation(washerId,washer.currentUserId)});
  }catch(e){return apiError(e);}
}
