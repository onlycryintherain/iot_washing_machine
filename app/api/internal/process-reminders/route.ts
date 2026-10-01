import { NextResponse } from 'next/server';
import { requireBearer, apiError } from '@/lib/http';
import { processPendingCompletionNotifications, processPickupReminders } from '@/lib/washer/service';

export async function POST(request:Request){
  if(!requireBearer(request,process.env.DEVICE_API_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const completions=await processPendingCompletionNotifications();
    const reminders=await processPickupReminders();
    return NextResponse.json({completions,reminders});
  }catch(e){return apiError(e);}
}
