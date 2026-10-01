import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { washers } from '@/lib/db/schema';
import { equivalentUserIds, userFromRequest } from '@/lib/auth/identity';
import { apiError } from '@/lib/http';
export async function GET(request:Request){
  try{
    const db=getDb(),user=await userFromRequest(request);
    if(request.headers.has('authorization')&&!user)return NextResponse.json({error:'사용자 정보를 다시 등록해주세요.'},{status:401});
    const ownerIds=user?await equivalentUserIds(user.id):[];
    const rows=await db.select().from(washers).orderBy(asc(washers.id));
    const list=rows.map(washer=>({...washer,isMine:!!washer.currentUserId&&ownerIds.includes(washer.currentUserId)}));
    return NextResponse.json({washers:list,myWasher:list.find(washer=>washer.isMine)??null});
  }catch(e){return apiError(e);}
}
