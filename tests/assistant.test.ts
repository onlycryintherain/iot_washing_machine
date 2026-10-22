import { describe, expect, it } from 'vitest';
import {
  MIN_HISTORY_FOR_RECOMMENDATION,
  answerAvailability,
  answerBestTime,
  answerMyStatus,
  clockLabel,
  matchIntent,
  suggestedQuestions,
  type AssistantWasher,
} from '@/lib/assistant/answers';

// 2026-03-02T12:00:00Z is 21:00 in Korea.
const NOW = Date.UTC(2026, 2, 2, 12, 0, 0);
const washer = (overrides: Partial<AssistantWasher> = {}): AssistantWasher => ({
  id: '1', name: '세탁기 1', location: '1층', state: 'IDLE', startedAt: null, finishedAt: null, ...overrides,
});
const kstHour = (hour: number, day = 1) => new Date(Date.UTC(2026, 1, day, hour - 9, 0, 0));

describe('matchIntent', () => {
  it('maps every suggested question to its own intent', () => {
    for (const { intent, label } of suggestedQuestions) expect(matchIntent(label)).toBe(intent);
  });
  it.each([
    ['지금 쓸 수 있는 세탁기 있나요', 'availability'],
    ['언제 쓰면 안 붐벼?', 'best_time'],
    ['세탁 언제 끝날까', 'my_status'],
    ['알림이 안 와요', 'help'],
  ])('understands "%s"', (text, intent) => expect(matchIntent(text)).toBe(intent));
  it('returns null for unrelated text', () => {
    expect(matchIntent('오늘 날씨 어때')).toBeNull();
  });
});

describe('clockLabel', () => {
  it('formats in Korea time regardless of server timezone', () => {
    expect(clockLabel(NOW)).toBe('오후 9시 00분');
    expect(clockLabel(Date.UTC(2026, 2, 2, 15, 5))).toBe('오전 12시 05분');
  });
});

describe('answerAvailability', () => {
  it('lists idle washers first', () => {
    const { text } = answerAvailability([washer(), washer({ id: '2', name: '세탁기 2', state: 'FINISHED' })], NOW);
    expect(text).toContain('1대 있어요');
    expect(text).toContain('세탁기 1(1층): 지금 바로 사용할 수 있어요');
    expect(text).toContain('수거를 기다리고');
  });
  it('reports remaining time when everything is busy', () => {
    const startedAt = new Date(NOW - 6_000);
    const { text } = answerAvailability([washer({ state: 'RUNNING', startedAt })], NOW);
    expect(text).toContain('모든 세탁기가 사용 중');
    expect(text).toContain('약 24분 뒤');
  });
  it('does not claim completion while the end signal is pending', () => {
    const { text } = answerAvailability([washer({ state: 'RUNNING', startedAt: new Date(NOW - 60_000) })], NOW);
    expect(text).toContain('종료 신호를 확인');
  });
});

describe('answerMyStatus', () => {
  it('points to the scanner when the user has no washer', () => {
    const reply = answerMyStatus(null, NOW);
    expect(reply.links?.[0].href).toBe('/scan');
  });
  it('shows time since finish for a finished wash', () => {
    const { text } = answerMyStatus(washer({ state: 'FINISHED', finishedAt: new Date(NOW - 150_000) }), NOW);
    expect(text).toContain('2분 전');
  });
  it('links to the washer detail page', () => {
    expect(answerMyStatus(washer({ id: '2', state: 'RESERVED' }), NOW).links?.[0].href).toBe('/washer/2');
  });
});

describe('answerBestTime', () => {
  it('refuses to recommend from too little history', () => {
    const { reply, enoughData } = answerBestTime([kstHour(14)], NOW);
    expect(enoughData).toBe(false);
    expect(reply.text).toContain('1건뿐');
  });
  it('recommends the quietest hours and names the busiest one', () => {
    const starts = [
      ...Array.from({ length: 8 }, (_, i) => kstHour(21, i + 1)),
      ...Array.from({ length: 4 }, (_, i) => kstHour(19, i + 1)),
      kstHour(14),
    ];
    expect(starts.length).toBeGreaterThanOrEqual(MIN_HISTORY_FOR_RECOMMENDATION);
    const { reply, enoughData } = answerBestTime(starts, NOW);
    expect(enoughData).toBe(true);
    expect(reply.text).toContain('가장 붐비는 시간대: 오후 9시(8건)');
    expect(reply.text).toContain('지금이 가장 붐비는 시간대');
    const quiet = reply.text.split('\n').find((line) => line.includes('한산한'))!;
    expect(quiet).not.toContain('오후 9시');
    expect(quiet).not.toContain('오후 7시');
  });
  it('never recommends late-night hours', () => {
    const starts = Array.from({ length: 12 }, (_, i) => kstHour(12 + (i % 6), i + 1));
    const quiet = answerBestTime(starts, NOW).reply.text.split('\n').find((line) => line.includes('한산한'))!;
    expect(quiet).not.toMatch(/오전 (12|[1-6])시/);
  });
});
