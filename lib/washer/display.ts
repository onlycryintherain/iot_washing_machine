import type { WasherState } from './state-machine';
import { cycleProgress } from './simulation';

export type DisplayStatus = 'available' | 'in_use' | 'unavailable';
export type DisplayWasher = { id: string; name: string; status: DisplayStatus; state: WasherState; minutesLeft: number | null; endsAt: string | null };
type Row = { id: string; name: string; state: WasherState; startedAt: Date | null; pausedAt: Date | null };

const statusOf: Record<WasherState, DisplayStatus> = {
  IDLE: 'available',
  RESERVED: 'in_use',
  RUNNING: 'in_use',
  MAYBE_FINISHED: 'in_use',
  PAUSED: 'in_use',
  // Done but not emptied yet, or out of service: nobody can start a wash.
  FINISHED: 'unavailable',
  WAITING_FOR_PICKUP: 'unavailable',
  OUT_OF_ORDER: 'unavailable',
};

// Only what the floor board shows: never a name or student id. The end time is "now + minutes left" so it agrees with the minutes shown.
export function toDisplayWasher(row: Row, now: number): DisplayWasher {
  const timed = !!row.startedAt && (row.state === 'RUNNING' || row.state === 'MAYBE_FINISHED' || row.state === 'PAUSED');
  const reference = row.state === 'PAUSED' && row.pausedAt ? row.pausedAt.getTime() : now;
  const minutesLeft = timed ? cycleProgress(row.startedAt!.getTime(), reference).minutesLeft : null;
  return {
    id: row.id,
    name: row.name,
    status: statusOf[row.state],
    state: row.state,
    minutesLeft,
    endsAt: minutesLeft === null ? null : new Date(now + minutesLeft * 60_000).toISOString(),
  };
}

export function displayOverview(rows: Row[], now = Date.now()) {
  const washers = rows.map((row) => toDisplayWasher(row, now));
  return { now: new Date(now).toISOString(), total: washers.length, available: washers.filter((washer) => washer.status === 'available').length, washers };
}
