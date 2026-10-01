'use client';

import { useEffect, useState } from 'react';
import { SIMULATED_CYCLE_MINUTES, SIMULATION_DURATION_SECONDS } from '@/lib/washer/simulation';

function expectedTimeLabel(timestamp: number) {
  const date = new Date(timestamp);
  const hour = date.getHours();
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시 ${String(date.getMinutes()).padStart(2, '0')}분`;
}

export function WasherTiming({ startedAt, compact = false }: { startedAt: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(startedAt).getTime() + SIMULATION_DURATION_SECONDS * 1000;
    if (!Number.isFinite(end)) return;
    const tick = () => setNow(Date.now());
    tick();
    if (Date.now() >= end) return;
    const interval = setInterval(() => {
      tick();
      if (Date.now() >= end) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started) || now === null) return null;

  const duration = SIMULATION_DURATION_SECONDS * 1000;
  const elapsed = Math.max(0, now - started);
  const progress = Math.min(100, (elapsed / duration) * 100);
  const minutesLeft = Math.max(0, Math.ceil(SIMULATED_CYCLE_MINUTES * (1 - progress / 100)));
  const expected = expectedTimeLabel(started + duration);
  const waiting = elapsed >= duration;

  if (compact) {
    return <span className="washer-eta-compact">
      {waiting ? '종료 신호 확인 중' : `${minutesLeft}분 남음 · 완료 예정 ${expected}`}
    </span>;
  }

  return <div className="washer-timing" aria-label="세탁 진행 시간">
    <strong className="washer-timing-remaining">
      {waiting ? '종료 신호 확인 중' : `${minutesLeft}분 남음`}
    </strong>
    <div className="washer-timing-track" role="progressbar" aria-label="세탁 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <span style={{ width: `${progress}%` }} />
    </div>
    <div className="washer-timing-meta">
      <span>{waiting ? '종료 상태 확인 중' : `진행률 ${Math.round(progress)}%`}</span>
      <span>완료 예정 {expected}</span>
    </div>
  </div>;
}
