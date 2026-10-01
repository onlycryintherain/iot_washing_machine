import { NextResponse } from 'next/server';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { subscriptions, washers, users } from '@/lib/db/schema';
import { processWasherEvent, reserveWasher } from '@/lib/washer/service';
import { createUser } from '@/lib/auth/identity';
import { apiError } from '@/lib/http';
import { SIMULATION_DURATION_SECONDS } from '@/lib/washer/simulation';
function authorized(request: Request) { return !!process.env.ADMIN_PASSWORD && request.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD; }
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const db = getDb();
    const [machineList, userList, pushList] = await Promise.all([
      db.select().from(washers).orderBy(asc(washers.id)),
      db.select({ id: users.id, nickname: users.nickname, studentId: users.studentId, userCode: users.userCode, createdAt: users.createdAt }).from(users).orderBy(asc(users.createdAt)),
      db.select({ userId: subscriptions.userId }).from(subscriptions),
    ]);
    const deviceCounts = new Map<string, number>();
    for (const item of pushList) deviceCounts.set(item.userId, (deviceCounts.get(item.userId) ?? 0) + 1);
    const withElapsed = machineList.map((washer) => ({ ...washer, elapsedMinutes: washer.startedAt && ['RUNNING', 'MAYBE_FINISHED'].includes(washer.state) ? Math.max(0, Math.floor((Date.now() - washer.startedAt.getTime()) / 60000)) : null }));
    return NextResponse.json({ washers: withElapsed, users: userList.map((item) => ({ ...item, hasPush: (deviceCounts.get(item.id) ?? 0) > 0, pushDevices: deviceCounts.get(item.id) ?? 0 })) });
  } catch (error) { return apiError(error); }
}

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reserve'), washerId: z.string(), userId: z.string() }),
  z.object({ action: z.literal('simulate'), washerId: z.string() }),
  z.object({ action: z.literal('event'), washerId: z.string(), event: z.enum(['PICKUP', 'RESET']) }),
  z.object({ action: z.literal('demo-user'), nickname: z.string().trim().min(1).max(24) }),
]);

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  try {
    const data = schema.parse(await request.json());
    if (data.action === 'demo-user') return NextResponse.json({ user: (await createUser(data.nickname)).user });
    if (data.action === 'reserve') return NextResponse.json({ washer: await reserveWasher(data.washerId, data.userId) });
    if (data.action === 'event') return NextResponse.json({ washer: await processWasherEvent(data.washerId, data.event) });
    await processWasherEvent(data.washerId, 'START', { vibration: 16, current: .42, doorOpen: false });
    await new Promise((resolve) => setTimeout(resolve, SIMULATION_DURATION_SECONDS * 1000));
    const [washer] = await getDb().select({ state: washers.state }).from(washers).where(eq(washers.id, data.washerId)).limit(1);
    if (washer?.state !== 'RUNNING') return NextResponse.json({ error: '시뮬레이션 중 세탁기 상태가 변경되었습니다.' }, { status: 409 });
    const finished = await processWasherEvent(data.washerId, 'FINISH', { vibration: 0, current: 0, doorOpen: false });
    return NextResponse.json({ washer: finished });
  } catch (error) { return apiError(error); }
}
