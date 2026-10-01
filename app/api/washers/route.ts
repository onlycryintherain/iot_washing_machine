import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { washers } from '@/lib/db/schema';
import { userFromRequest } from '@/lib/auth/identity';
import { apiError } from '@/lib/http';
export async function GET(request:Request){try{const db=getDb(),user=await userFromRequest(request);const list=await db.select().from(washers).orderBy(asc(washers.id));return NextResponse.json({washers:list,myWasher:list.find(w=>w.currentUserId===user?.id)??null});}catch(e){return apiError(e);}}
