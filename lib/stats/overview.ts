import { toDisplayMinutes } from '@/lib/washer/simulation';

const KST_OFFSET_MS = 9 * 3600_000;
export const OVERVIEW_DAYS = 30;
export const MIN_SESSIONS_FOR_CHART = 10;

export type CrowdLevel = 'quiet' | 'normal' | 'busy' | 'unknown';

export function kstHour(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).getUTCHours();
}

export function startOfKstDay(now: number) {
  const kst = new Date(now + KST_OFFSET_MS);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS;
}

export function hourlyCounts(starts: Date[]) {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const start of starts) counts[kstHour(start)]++;
  return counts;
}

export function crowdLevel(counts: number[], hour: number): CrowdLevel {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (total < MIN_SESSIONS_FOR_CHART) return 'unknown';
  const ratio = counts[hour] / Math.max(...counts);
  return ratio <= 1 / 3 ? 'quiet' : ratio <= 2 / 3 ? 'normal' : 'busy';
}

export type SessionTimes = { startedAt: Date; finishedAt: Date | null };

export function summarizeToday(sessions: SessionTimes[], now: number) {
  const start = startOfKstDay(now);
  const today = sessions.filter((session) => session.startedAt.getTime() >= start);
  const finished = today.filter((session) => session.finishedAt);
  const avgMinutes = finished.length
    ? Math.round(finished.reduce((sum, session) => sum + toDisplayMinutes(session.finishedAt!.getTime() - session.startedAt.getTime()), 0) / finished.length)
    : null;
  return { count: today.length, avgMinutes };
}

export const eventLabels: Record<string, string> = {
  RESERVE: '사용 등록',
  CANCEL_RESERVATION: '등록 취소',
  START: '세탁 시작',
  ACTIVITY: '동작 감지',
  NO_ACTIVITY: '동작 멈춤',
  RESUME: '다시 동작',
  FINISH: '세탁 완료',
  DOOR_OPEN: '문 열림',
  PICKUP: '수거 완료',
  RESET: '초기화',
};
