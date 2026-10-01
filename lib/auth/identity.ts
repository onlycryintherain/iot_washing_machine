import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
export function tokenDigest(token:string){ return createHash('sha256').update(token).digest('hex'); }
export async function userFromRequest(request:Request) {
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,''); if(!token) return null;
  const [user]=await getDb().select({id:users.id,nickname:users.nickname,userCode:users.userCode}).from(users).where(eq(users.tokenHash,tokenDigest(token))).limit(1); return user??null;
}
export async function createUser(nickname:string,studentId?:string) {
  const token=randomBytes(32).toString('base64url');
  for(let attempt=0;attempt<5;attempt++){
    try{const [user]=await getDb().insert(users).values({id:randomUUID(),nickname:nickname.trim().slice(0,24),studentId:studentId?.trim()||null,userCode:String(randomInt(1000,10000)),tokenHash:tokenDigest(token)}).returning({id:users.id,nickname:users.nickname,userCode:users.userCode});return {user,token};}
    catch(error){if(typeof error!=='object'||error===null||!('code'in error)||(error as {code:string}).code!=='23505'||attempt===4)throw error;}
  }
  throw new Error('Unable to create user');
}
