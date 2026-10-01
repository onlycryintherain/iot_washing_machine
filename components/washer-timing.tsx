'use client';

import { useEffect, useState } from 'react';
import { SIMULATED_CYCLE_MINUTES, SIMULATION_DURATION_SECONDS } from '@/lib/washer/simulation';

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
  const realSecondsLeft = Math.max(0, Math.ceil((duration - elapsed) / 1000));
  const virtualMinutesLeft = Math.max(0, Math.ceil(SIMULATED_CYCLE_MINUTES * (1 - progress / 100)));
  const expected = new Date(started + duration).toLocaleTimeString('ko-KR', {
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
  const waiting = realSecondsLeft === 0;

  if (compact) {
    return <span className="washer-eta-compact">
      {waiting ? '종료 신호 확인 중' : `약 ${realSecondsLeft}초 남음 · 가상 ${virtualMinutesLeft}분`}
    </span>;
  }

  return <div className="washer-timing" aria-label="세탁 진행 시간">
    <strong className="washer-timing-remaining">
      {waiting ? '종료 신호 확인 중' : `약 ${realSecondsLeft}초 남음`}
    </strong>
    <div className="washer-timing-track" role="progressbar" aria-label="가상 세탁 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <span style={{ width: `${progress}%` }} />
    </div>
    <div className="washer-timing-meta">
      <span>{waiting ? '가상 세탁 48분 경과' : `가상 세탁 ${virtualMinutesLeft}분 남음 · ${Math.round(progress)}% 진행`}</span>
      <span>완료 예정 {expected}</span>
    </div>
    <p className="washer-timing-note">48분 세탁을 약 12초로 압축해 보여줍니다. 실제 완료는 세탁기 종료 신호로 확인해요.</p>
  </div>;
}
