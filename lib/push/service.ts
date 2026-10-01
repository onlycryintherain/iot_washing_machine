import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { subscriptions } from '@/lib/db/schema';
import { equivalentUserIds } from '@/lib/auth/identity';
let configured=false;
function setup(){ if(configured)return; const {NEXT_PUBLIC_VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:privateKey,VAPID_SUBJECT:subject}=process.env; if(!publicKey||!privateKey||!subject)throw new Error('VAPID is not configured'); webpush.setVapidDetails(subject,publicKey,privateKey); configured=true; }
export async function sendUserPush(userId:string,payload:object){
  setup();
  const db=getDb();
  const matchingUserIds=await equivalentUserIds(userId);
  const rows=await db.select().from(subscriptions).where(inArray(subscriptions.userId,matchingUserIds));
  const results=await Promise.allSettled(rows.map(async row=>{try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload));}catch(error){
    const status=typeof error==='object'&&error!==null&&'statusCode'in error?(error as {statusCode:number}).statusCode:null;
    if(status===404||status===410)await getDb().delete(subscriptions).where(eq(subscriptions.id,row.id));
    console.error('Web Push delivery failed',status===null?'unknown status':`HTTP ${status}`);
    throw error;
  }}));
  const failed=results.filter(r=>r.status==='rejected').length; return {sent:results.length-failed,failed};
}
export function vapidPublicKey(){return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY??'';}
