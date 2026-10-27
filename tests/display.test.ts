import { describe, expect, it } from 'vitest';
import { displayOverview, toDisplayWasher } from '@/lib/washer/display';

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const row = (state: Parameters<typeof toDisplayWasher>[0]['state'], startedAt: number | null = null, pausedAt: number | null = null) => ({
  id: '1', name: '1번 세탁기', state, startedAt: startedAt === null ? null : new Date(startedAt), pausedAt: pausedAt === null ? null : new Date(pausedAt),
});

describe('floor board feed', () => {
  it('maps every state to one of the three board labels', () => {
    expect(toDisplayWasher(row('IDLE'), NOW).status).toBe('available');
    for (const state of ['RESERVED', 'RUNNING', 'MAYBE_FINISHED', 'PAUSED'] as const) expect(toDisplayWasher(row(state), NOW).status).toBe('in_use');
    for (const state of ['FINISHED', 'WAITING_FOR_PICKUP', 'OUT_OF_ORDER'] as const) expect(toDisplayWasher(row(state), NOW).status).toBe('unavailable');
  });

  it('gives minutes left and an end time consistent with them while running', () => {
    const washer = toDisplayWasher(row('RUNNING', NOW - 6_000), NOW); // half of the 12 s cycle
    expect(washer.minutesLeft).toBe(24);
    expect(washer.endsAt).toBe(new Date(NOW + 24 * 60_000).toISOString());
  });

  it('freezes the remaining time while paused', () => {
    const washer = toDisplayWasher(row('PAUSED', NOW - 60_000, NOW - 54_000), NOW);
    expect(washer.minutesLeft).toBe(24);
  });

  it('has no time for washers that are not mid-cycle', () => {
    expect(toDisplayWasher(row('IDLE'), NOW)).toMatchObject({ minutesLeft: null, endsAt: null });
    expect(toDisplayWasher(row('OUT_OF_ORDER'), NOW)).toMatchObject({ minutesLeft: null, endsAt: null });
  });

  it('counts available washers and exposes nothing about people', () => {
    const feed = displayOverview([row('IDLE'), { ...row('OUT_OF_ORDER'), id: '3' }, { ...row('RUNNING', NOW), id: '2' }], NOW);
    expect(feed).toMatchObject({ total: 3, available: 1 });
    expect(JSON.stringify(feed)).not.toMatch(/user|student/i);
  });
});
