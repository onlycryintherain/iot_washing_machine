import dotenv from 'dotenv';
import { getDb } from '../lib/db';
import { washers } from '../lib/db/schema';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main(){
  const db=getDb();
  await db.insert(washers).values([{id:'1',name:'1번 세탁기',location:'기숙사 세탁실'},{id:'2',name:'2번 세탁기',location:'기숙사 세탁실'}]).onConflictDoNothing();
  console.log('Seeded washers 1 and 2.');
}
main().catch(error=>{console.error('Neon seed failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
