import { describe, expect, it } from 'vitest';
import { crowdLevel, hourlyCounts, kstHour, startOfKstDay, summarizeToday } from '@/lib/stats/overview';
import { toDisplayMinutes } from '@/lib/washer/simulation';

// 2026-03-02 12:00 UTC is 21:00 in Korea.
const NOW = Date.UTC(2026, 2, 2, 12, 0, 0);
const kst = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 2, day, hour - 9, minute));

describe('KST helpers', () => {
  it('reads the hour in Korea time', () => {
    expect(kstHour(new Date(NOW))).toBe(21);
    expect(kstHour(new Date(Date.UTC(2026, 2, 2, 15, 30)))).toBe(0);
  });
  it('finds the start of the Korean day', () => {
    expect(startOfKstDay(NOW)).toBe(Date.UTC(2026, 2, 1, 15, 0, 0));
    expect(startOfKstDay(Date.UTC(2026, 2, 2, 14, 59))).toBe(Date.UTC(2026, 2, 1, 15, 0, 0));
    expect(startOfKstDay(Date.UTC(2026, 2, 2, 15, 0))).toBe(Date.UTC(2026, 2, 2, 15, 0, 0));
  });
});

describe('hourlyCounts and crowdLevel', () => {
  const starts = [...Array.from({ length: 9 }, () => kst(1, 21)), ...Array.from({ length: 4 }, () => kst(1, 14)), kst(1, 8)];
  it('counts sessions per Korean hour', () => {
    const counts = hourlyCounts(starts);
    expect(counts[21]).toBe(9);
    expect(counts[14]).toBe(4);
    expect(counts[8]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(14);
  });
  it('rates the current hour against the busiest one', () => {
    const counts = hourlyCounts(starts);
    expect(crowdLevel(counts, 21)).toBe('busy');
    expect(crowdLevel(counts, 14)).toBe('normal');
    expect(crowdLevel(counts, 8)).toBe('quiet');
  });
  it('refuses to judge with too little history', () => {
    expect(crowdLevel(hourlyCounts([kst(1, 9)]), 9)).toBe('unknown');
  });
});

describe('summarizeToday', () => {
  const cycle = 12_000;
  it('counts only today and averages finished sessions in display minutes', () => {
    const sessions = [
      { startedAt: kst(2, 9), finishedAt: new Date(kst(2, 9).getTime() + cycle) },
      { startedAt: kst(2, 10), finishedAt: null },
      { startedAt: kst(1, 22), finishedAt: new Date(kst(1, 22).getTime() + cycle) },
    ];
    expect(summarizeToday(sessions, NOW)).toEqual({ count: 2, avgMinutes: 48 });
  });
  it('has no average before anything finished', () => {
    expect(summarizeToday([], NOW)).toEqual({ count: 0, avgMinutes: null });
  });
});

describe('durations', () => {
  it('scales the compressed cycle back to display minutes', () => {
    expect(toDisplayMinutes(12_000)).toBe(48);
    expect(toDisplayMinutes(6_000)).toBe(24);
    expect(toDisplayMinutes(10)).toBe(1);
  });
});
