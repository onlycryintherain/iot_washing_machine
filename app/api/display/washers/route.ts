import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { washers } from '@/lib/db/schema';
import { apiError, requireBearer, unauthorized } from '@/lib/http';
import { displayOverview } from '@/lib/washer/display';

// Read-only feed for the floor status board (ESP32). Same device key as the event API; exposes no user data.
export async function GET(request: Request) {
  if (!requireBearer(request, process.env.DEVICE_API_SECRET)) return unauthorized();
  try {
    const rows = await getDb().select({ id: washers.id, name: washers.name, state: washers.state, startedAt: washers.startedAt, pausedAt: washers.pausedAt }).from(washers).orderBy(asc(washers.id));
    return NextResponse.json(displayOverview(rows), { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
