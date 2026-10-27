import { NextResponse } from 'next/server';
import { processWasherEvent } from '@/lib/washer/service';
import { requireWasherOwner } from '@/lib/washer/ownership';
import { apiError } from '@/lib/http';

export async function POST(request:Request,{params}:{params:Promise<{washerId:string}>}){
  try{
    const {washerId}=await params;
    await requireWasherOwner(request,washerId);
    return NextResponse.json({washer:await processWasherEvent(washerId,'PAUSE')});
  }catch(e){return apiError(e);}
}
