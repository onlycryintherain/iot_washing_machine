import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { events, reminderLog, sessions, washers } from '@/lib/db/schema';
import { transition, type WasherEvent, type WasherState } from './state-machine';
import { sendUserPush } from '@/lib/push/service';
export async function processWasherEvent(washerId:string,event:WasherEvent,sensors?:{vibration?:number;current?:number;doorOpen?:boolean},timestamp=new Date()) {
  const db=getDb(); const [washer]=await db.select().from(washers).where(eq(washers.id,washerId)).limit(1); if(!washer)throw new Error('Washer not found');
  const next=transition(washer.state as WasherState,event);
  const changes:Partial<typeof washers.$inferInsert>={state:next,updatedAt:timestamp};
  if(event==='START'){changes.startedAt=timestamp;changes.lastActivityAt=timestamp;}
  if(event==='ACTIVITY'||event==='RESUME'){changes.lastActivityAt=timestamp;}
  if(event==='FINISH'){changes.finishedAt=timestamp;}
  if(event==='PICKUP'||event==='RESET'){changes.currentUserId=null;changes.reservedAt=null;changes.startedAt=null;changes.finishedAt=null;changes.lastActivityAt=null;changes.pushSentAt=null;}
  if(event==='RESET'||event==='PICKUP'){changes.doorOpen=false;changes.vibration=null;changes.current=null;}
  if(event==='DOOR_OPEN')changes.doorOpen=true;
  if(sensors?.doorOpen!==undefined)changes.doorOpen=sensors.doorOpen;
  if(sensors?.vibration!==undefined)changes.vibration=sensors.vibration;
  if(sensors?.current!==undefined)changes.current=sensors.current;
  const [updated]=await db.update(washers).set(changes).where(and(eq(washers.id,washerId),eq(washers.state,washer.state))).returning();
  if(!updated)throw new Error('Washer state changed; refresh and retry');
  await db.insert(events).values({id:randomUUID(),washerId,type:event,vibration:sensors?.vibration,current:sensors?.current,doorOpen:sensors?.doorOpen??(event==='DOOR_OPEN'?true:undefined),createdAt:timestamp});
  if(event==='START')await db.update(sessions).set({status:'RUNNING',startedAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'RESERVED')));
  if(event==='RESERVE'&&washer.currentUserId){await db.update(sessions).set({status:'RESERVED',updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.userId,washer.currentUserId),isNull(sessions.finishedAt)));}
  if(next==='FINISHED'&&washer.state!=='FINISHED'){
    const [session]=await db.select().from(sessions).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'RUNNING'))).orderBy(desc(sessions.createdAt)).limit(1);
    if(session){const [claimed]=await db.update(sessions).set({status:'FINISHED',finishedAt:timestamp,finishedNotificationSentAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.id,session.id),isNull(sessions.finishedNotificationSentAt))).returning({id:sessions.id});
      if(claimed){await db.update(washers).set({pushSentAt:timestamp}).where(eq(washers.id,washerId));try{await sendUserPush(session.userId,{title:'세탁이 완료됐어요',body:`${washer.name}의 세탁이 완료되었습니다. 세탁물을 확인해주세요.`,url:`/washer/${washerId}`,washerId,type:'WASH_FINISHED'});}catch(error){console.error('Laundry completion push failed',error);}}
    }
  }
  if(event==='PICKUP')await db.update(sessions).set({status:'PICKED_UP',pickedUpAt:timestamp,updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),eq(sessions.status,'FINISHED')));
  if(event==='RESET')await db.update(sessions).set({status:'CANCELLED',updatedAt:timestamp}).where(and(eq(sessions.washerId,washerId),inArray(sessions.status,['RESERVED','RUNNING','FINISHED'])));
  return updated;
}
export async function reserveWasher(washerId:string,userId:string){
 const db=getDb(), now=new Date(), next=transition('IDLE','RESERVE'); const [updated]=await db.update(washers).set({state:next,currentUserId:userId,reservedAt:now,updatedAt:now,pushSentAt:null}).where(and(eq(washers.id,washerId),eq(washers.state,'IDLE'))).returning();
 if(!updated)throw new Error('방금 다른 사용자가 이 세탁기를 등록했습니다.');
 await db.insert(sessions).values({id:randomUUID(),washerId,userId,status:'RESERVED',reservedAt:now});await db.insert(events).values({id:randomUUID(),washerId,type:'RESERVE',createdAt:now});return updated;
}
export async function cancelReservation(washerId:string,userId:string){
 const db=getDb(), now=new Date(),next=transition('RESERVED','RESET');const [updated]=await db.update(washers).set({state:next,currentUserId:null,reservedAt:null,updatedAt:now}).where(and(eq(washers.id,washerId),eq(washers.state,'RESERVED'),eq(washers.currentUserId,userId))).returning();
 if(!updated)throw new Error('등록을 취소할 수 없습니다.');await db.insert(events).values({id:randomUUID(),washerId,type:'CANCEL_RESERVATION',createdAt:now});await db.update(sessions).set({status:'CANCELLED',updatedAt:now}).where(and(eq(sessions.washerId,washerId),eq(sessions.userId,userId),eq(sessions.status,'RESERVED')));return updated;
}
export async function processPickupReminders(now=new Date()){
 const db=getDb(), active=await db.select().from(sessions).where(eq(sessions.status,'FINISHED'));let sent=0;
 for(const session of active){if(!session.finishedAt)continue;const minutes=(now.getTime()-session.finishedAt.getTime())/60000;const reminders=session.remindersSent??[];
  for(const minute of [10,20])if(minutes>=minute&&!reminders.includes(minute)){const [claim]=await db.insert(reminderLog).values({id:randomUUID(),sessionId:session.id,reminderMinutes:minute,sentAt:now}).onConflictDoNothing().returning({id:reminderLog.id});if(!claim)continue;try{const result=await sendUserPush(session.userId,{title:'세탁물을 확인해주세요',body:`세탁 완료 후 ${minute}분이 지났습니다.`,url:`/washer/${session.washerId}`,washerId:session.washerId,type:'PICKUP_REMINDER'});if(result.sent){await db.update(sessions).set({remindersSent:[...reminders,minute],updatedAt:now}).where(eq(sessions.id,session.id));reminders.push(minute);sent+=result.sent;}else await db.delete(reminderLog).where(eq(reminderLog.id,claim.id));}catch(e){await db.delete(reminderLog).where(eq(reminderLog.id,claim.id));console.error('Pickup reminder push failed',e instanceof Error?e.message:'Unknown error');}}
 }
 return {processed:active.length,sent};
}
