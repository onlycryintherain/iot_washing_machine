import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { events, reminderLog, sessions, washers } from '@/lib/db/schema';
import { transition, type WasherEvent, type WasherState } from './state-machine';
import { HttpError } from '@/lib/errors';
import { sendUserPush } from '@/lib/push/service';
import { describeError } from '@/lib/errors';
import { ENDING_SOON_MINUTES, endingSoonDelayMs } from './simulation';
export async function processWasherEvent(washerId:string,event:WasherEvent,sensors?:{vibration?:number;current?:number;doorOpen?:boolean},timestamp=new Date()) {
  const db=getDb(); const [washer]=await db.select().from(washers).where(eq(washers.id,washerId)).limit(1); if(!washer)throw new HttpError(404,'Washer not found');
  const next=transition(washer.state as WasherState,event);
  const changes:Partial<typeof washers.$inferInsert>={state:next,updatedAt:timestamp};
  if(event==='START'){changes.startedAt=timestamp;changes.lastActivityAt=timestamp;}
  if(event==='ACTIVITY'||event==='RESUME'){changes.lastActivityAt=timestamp;}
  if(event==='FINISH'){changes.finishedAt=timestamp;}
  if(event==='PAUSE')changes.pausedAt=timestamp;
  // Time spent paused must not count toward the cycle, so the start moves forward by that long.
  const resumedFromPause=event==='RESUME'&&washer.state==='PAUSED';
  if(resumedFromPause){changes.pausedAt=null;if(washer.pausedAt&&washer.startedAt)changes.startedAt=new Date(washer.startedAt.getTime()+Math.max(0,timestamp.getTime()-washer.pausedAt.getTime()));}
  if(event==='PICKUP'||event==='RESET'){changes.currentUserId=null;changes.reservedAt=null;changes.startedAt=null;changes.finishedAt=null;changes.lastActivityAt=null;changes.pushSentAt=null;changes.pausedAt=null;}
  if(event==='RESET'||event==='PICKUP'){changes.doorOpen=false;changes.vibration=null;changes.current=null;}
  if(event==='DOOR_OPEN')changes.doorOpen=true;
  if(sensors?.doorOpen!==undefined)changes.doorOpen=sensors.doorOpen;
  if(sensors?.vibration!==undefined)changes.vibration=sensors.vibration;
  if(sensors?.current!==undefined)changes.current=sensors.current;
  const [updated]=await db.update(washers).set(changes).where(and(eq(washers.id,washerId),eq(washers.state,washer.state))).returning();
  if(!updated)throw new HttpError(409,'Washer state changed; refresh and retry');
  await db.insert(events).values({id:randomUUID(),washerId,type:event,vibration:sensors?.vibration,current:sensors?.current,doorOpen:sensors?.doorOpen??(event==='DOOR_OPEN'?true:undefined),createdAt:timestamp});
  if(resumedFromPause&&changes.startedAt)await db.update(sessions).set({startedAt:changes.startedAt,updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'RUNNING')));
  if(event==='START'){
    const started=await db.update(sessions).set({status:'RUNNING',startedAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'RESERVED'))).returning({id:sessions.id});
    for(const session of started)scheduleEndingSoon(session.id);
  }
  if(event==='RESERVE'&&washer.currentUserId){await db.update(sessions).set({status:'RESERVED',updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.userId,washer.currentUserId),isNull(sessions.finishedAt)));}
  if(next==='FINISHED'&&washer.state!=='FINISHED'){
    const [session]=await db.select().from(sessions).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'RUNNING'))).orderBy(desc(sessions.createdAt)).limit(1);
    if(session){
      const [finished]=await db.update(sessions).set({status:'FINISHED',finishedAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.id,session.id),eq(sessions.status,'RUNNING'))).returning();
      if(finished) await sendCompletionNotification(finished,washer.name,timestamp);
    }
  }
  if(event==='PICKUP')await db.update(sessions).set({status:'PICKED_UP',pickedUpAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'FINISHED')));
  if(event==='RESET')await db.update(sessions).set({status:'CANCELLED',updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),inArray(sessions.status,['RESERVED','RUNNING','FINISHED'])));
  return updated;
}
async function sendCompletionNotification(session:typeof sessions.$inferSelect,washerName:string,now:Date){
  try{
    const result=await sendUserPush(session.userId,{title:'세탁이 완료됐어요',body:`${washerName}의 세탁이 끝났어요. 세탁물을 확인해주세요.`,url:`/washer/${session.washerId}`,washerId:session.washerId,type:'WASH_FINISHED'});
    if(!result.sent)return 0;
    await getDb().update(sessions).set({finishedNotificationSentAt:now,updatedAt:now}).where(and(eq(sessions.id,session.id),eq(sessions.status,'FINISHED'),isNull(sessions.finishedNotificationSentAt)));
    await getDb().update(washers).set({pushSentAt:now}).where(and(eq(washers.id,session.washerId),eq(washers.currentUserId,session.userId)));
    return result.sent;
  }catch(error){console.error('Laundry completion push failed',error instanceof Error?error.message:'Unknown error');return 0;}
}
export async function processPendingCompletionNotifications(now=new Date()){
  const db=getDb();
  const pending=await db.select().from(sessions).where(and(eq(sessions.status,'FINISHED'),isNull(sessions.finishedNotificationSentAt),gte(sessions.finishedAt,new Date(now.getTime()-30*60_000)))).limit(100);
  let sent=0;
  for(const session of pending){
    const [washer]=await db.select({name:washers.name}).from(washers).where(eq(washers.id,session.washerId)).limit(1);
    sent+=await sendCompletionNotification(session,washer?.name??'세탁기',now);
  }
  return {processed:pending.length,sent};
}
export async function reserveWasher(washerId:string,userId:string){
 const db=getDb(), now=new Date(), next=transition('IDLE','RESERVE'); const [updated]=await db.update(washers).set({state:next,currentUserId:userId,reservedAt:now,updatedAt:now,pushSentAt:null}).where(and(eq(washers.id,washerId),eq(washers.state,'IDLE'))).returning();
 if(!updated)throw new HttpError(409,'방금 다른 사용자가 이 세탁기를 등록했어요.');
 await db.insert(sessions).values({id:randomUUID(),washerId,userId,status:'RESERVED',reservedAt:now});await db.insert(events).values({id:randomUUID(),washerId,type:'RESERVE',createdAt:now});return updated;
}
export async function cancelReservation(washerId:string,userId:string){
 const db=getDb(), now=new Date(),next=transition('RESERVED','RESET');const [updated]=await db.update(washers).set({state:next,currentUserId:null,reservedAt:null,updatedAt:now}).where(and(eq(washers.id,washerId),eq(washers.state,'RESERVED'),eq(washers.currentUserId,userId))).returning();
 if(!updated)throw new HttpError(409,'등록을 취소할 수 없어요.');await db.insert(events).values({id:randomUUID(),washerId,type:'CANCEL_RESERVATION',createdAt:now});await db.update(sessions).set({status:'CANCELLED',updatedAt:now}).where(and(eq(sessions.washerId,washerId),eq(sessions.userId,userId),eq(sessions.status,'RESERVED')));return updated;
}
export async function processPickupReminders(now=new Date()){
 const db=getDb(), active=await db.select().from(sessions).where(and(eq(sessions.status,'FINISHED'),gte(sessions.finishedAt,new Date(now.getTime()-60*60_000))));let sent=0;
 for(const session of active){if(!session.finishedAt)continue;const minutes=(now.getTime()-session.finishedAt.getTime())/60000;const reminders=session.remindersSent??[];
  if(minutes<2||reminders.includes(2))continue;
  const [claim]=await db.insert(reminderLog).values({id:randomUUID(),sessionId:session.id,reminderMinutes:2,sentAt:now}).onConflictDoNothing().returning({id:reminderLog.id});
  if(!claim)continue;
  try{
    const [stillWaiting]=await db.select({id:sessions.id}).from(sessions).where(and(eq(sessions.id,session.id),eq(sessions.status,'FINISHED'))).limit(1);
    if(!stillWaiting){await db.delete(reminderLog).where(eq(reminderLog.id,claim.id));continue;}
    const result=await sendUserPush(session.userId,{title:'세탁물을 수거해주세요',body:'세탁 완료 후 2분이 지났습니다. 세탁물을 수거해주세요.',url:`/washer/${session.washerId}`,washerId:session.washerId,type:'PICKUP_REMINDER'});
    if(result.sent){await db.update(sessions).set({remindersSent:[...reminders,2],updatedAt:now}).where(and(eq(sessions.id,session.id),eq(sessions.status,'FINISHED')));sent+=result.sent;}
    else await db.delete(reminderLog).where(eq(reminderLog.id,claim.id));
  }catch(e){await db.delete(reminderLog).where(eq(reminderLog.id,claim.id));console.error('Pickup reminder push failed',e instanceof Error?e.message:'Unknown error');}
 }
 return {processed:active.length,sent};
}

// "About 5 minutes left" heads-up. The claim (a conditional UPDATE) makes it at-most-once per wash, whichever of the timer or the minute tick gets there first.
export async function notifyEndingSoon(sessionId:string,now=new Date()){
  const db=getDb();
  const [claimed]=await db.update(sessions).set({endingSoonNotificationSentAt:now,updatedAt:now}).where(and(eq(sessions.id,sessionId),eq(sessions.status,'RUNNING'),isNull(sessions.endingSoonNotificationSentAt))).returning();
  if(!claimed)return 0;
  const [washer]=await db.select({name:washers.name}).from(washers).where(eq(washers.id,claimed.washerId)).limit(1);
  try{
    const result=await sendUserPush(claimed.userId,{title:'곧 끝나요',body:`${washer?.name??'세탁기'} 세탁이 약 ${ENDING_SOON_MINUTES}분 뒤에 끝나요. 세탁물 꺼낼 준비를 해주세요.`,url:`/washer/${claimed.washerId}`,washerId:claimed.washerId,type:'WASH_ENDING_SOON'});
    // Delivery failed everywhere: let the next tick retry. No devices at all is final.
    if(result.failed>0&&result.sent===0)await db.update(sessions).set({endingSoonNotificationSentAt:null}).where(eq(sessions.id,sessionId));
    return result.sent;
  }catch(error){
    await db.update(sessions).set({endingSoonNotificationSentAt:null}).where(eq(sessions.id,sessionId));
    console.error('Ending-soon push failed',describeError(error));
    return 0;
  }
}
// Fires at the exact moment (a minute tick is far too coarse for a 12 s demo cycle); lost on restart, so the tick below backs it up.
export function scheduleEndingSoon(sessionId:string){
  const timers=((globalThis as {endingSoonTimers?:Map<string,NodeJS.Timeout>}).endingSoonTimers??=new Map());
  if(timers.has(sessionId))return;
  const timer=setTimeout(()=>{timers.delete(sessionId);notifyEndingSoon(sessionId).catch(error=>console.error('Ending-soon timer failed',describeError(error)));},endingSoonDelayMs());
  timer.unref?.();
  timers.set(sessionId,timer);
}
export async function processEndingSoonNotifications(now=new Date()){
  const due=await getDb().select({id:sessions.id}).from(sessions).where(and(eq(sessions.status,'RUNNING'),isNull(sessions.endingSoonNotificationSentAt),lte(sessions.startedAt,new Date(now.getTime()-endingSoonDelayMs())),gte(sessions.startedAt,new Date(now.getTime()-60*60_000)))).limit(100);
  let sent=0;
  for(const session of due)sent+=await notifyEndingSoon(session.id,now);
  return {processed:due.length,sent};
}
