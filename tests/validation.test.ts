import { describe, expect, it } from 'vitest';
import { deviceEventSchema, onboardingSchema } from '@/lib/validation';

describe('deviceEventSchema (ESP32 payload contract)', () => {
  it('accepts an event with sensors and timestamp', () => {
    const parsed = deviceEventSchema.parse({
      event: 'ACTIVITY',
      timestamp: '2026-01-01T00:00:00.000Z',
      sensors: { vibration: 12, current: 0.4, doorOpen: false },
    });
    expect(parsed.event).toBe('ACTIVITY');
  });
  it('accepts an event without sensors', () => {
    expect(deviceEventSchema.parse({ event: 'FINISH' }).sensors).toBeUndefined();
  });
  it.each([
    { event: 'EXPLODE' },
    { event: 'ACTIVITY', sensors: { current: -1 } },
    { event: 'ACTIVITY', sensors: { vibration: 1.5 } },
    { event: 'ACTIVITY', timestamp: 'yesterday' },
    {},
  ])('rejects %j', (payload) => {
    expect(deviceEventSchema.safeParse(payload).success).toBe(false);
  });
});

describe('onboardingSchema', () => {
  it('trims input and requires both fields', () => {
    expect(onboardingSchema.parse({ nickname: ' 홍길동 ', studentId: ' 20240001 ' })).toEqual({ nickname: '홍길동', studentId: '20240001' });
    expect(onboardingSchema.safeParse({ nickname: '', studentId: '1' }).success).toBe(false);
    expect(onboardingSchema.safeParse({ nickname: 'a', studentId: '   ' }).success).toBe(false);
  });
});
