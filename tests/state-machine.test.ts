import { describe, expect, it } from 'vitest';
import { HttpError } from '@/lib/errors';
import { transition, type WasherEvent, type WasherState } from '@/lib/washer/state-machine';

describe('washer state machine', () => {
  it('follows the normal laundry cycle', () => {
    let state: WasherState = 'IDLE';
    for (const [event, expected] of [
      ['RESERVE', 'RESERVED'],
      ['START', 'RUNNING'],
      ['ACTIVITY', 'RUNNING'],
      ['NO_ACTIVITY', 'MAYBE_FINISHED'],
      ['FINISH', 'FINISHED'],
      ['DOOR_OPEN', 'WAITING_FOR_PICKUP'],
      ['PICKUP', 'IDLE'],
    ] as [WasherEvent, WasherState][]) {
      state = transition(state, event);
      expect(state).toBe(expected);
    }
  });

  it('returns to RUNNING when activity resumes while finish is unconfirmed', () => {
    expect(transition('MAYBE_FINISHED', 'ACTIVITY')).toBe('RUNNING');
    expect(transition('MAYBE_FINISHED', 'RESUME')).toBe('RUNNING');
  });

  it('pauses and resumes a running wash', () => {
    expect(transition('RUNNING', 'PAUSE')).toBe('PAUSED');
    expect(transition('MAYBE_FINISHED', 'PAUSE')).toBe('PAUSED');
    expect(transition('PAUSED', 'DOOR_OPEN')).toBe('PAUSED');
    expect(transition('PAUSED', 'RESUME')).toBe('RUNNING');
  });

  it('only an admin RESET brings an out-of-order washer back', () => {
    expect(transition('OUT_OF_ORDER', 'RESET')).toBe('IDLE');
  });

  it.each(['RESERVED', 'RUNNING', 'MAYBE_FINISHED', 'FINISHED', 'WAITING_FOR_PICKUP', 'PAUSED', 'OUT_OF_ORDER'] as WasherState[])(
    'RESET always frees a washer in %s',
    (state) => expect(transition(state, 'RESET')).toBe('IDLE'),
  );

  it.each([
    ['IDLE', 'FINISH'],
    ['IDLE', 'START'],
    ['IDLE', 'PICKUP'],
    ['RESERVED', 'FINISH'],
    ['RUNNING', 'RESERVE'],
    ['RUNNING', 'PICKUP'],
    ['FINISHED', 'START'],
    ['WAITING_FOR_PICKUP', 'FINISH'],
    ['IDLE', 'PAUSE'],
    ['PAUSED', 'FINISH'],
    ['PAUSED', 'START'],
    ['OUT_OF_ORDER', 'RESERVE'],
    ['OUT_OF_ORDER', 'START'],
  ] as [WasherState, WasherEvent][])('rejects %s + %s with a 409', (state, event) => {
    try {
      transition(state, event);
      expect.unreachable('transition should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(409);
    }
  });
});
