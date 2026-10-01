'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { WasherSummary } from '@/lib/washer/presentation';
import { washerPresentation } from '@/lib/washer/presentation';
import { WasherStatus } from '@/components/washer-status';

type Washer = WasherSummary & {
  reservedAt: string | null;
  lastActivityAt: string | null;
};

function timeLabel(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '';
}

export default function WasherPage({ params }: { params: Promise<{ washerId: string }> }) {
  const { washerId } = use(params);
  const [washer, setWasher] = useState<Washer | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const syncIdentity = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('laundry-user') ?? 'null');
        setUserId(saved?.id ?? null);
      } catch {
        setUserId(null);
      }
    };
    syncIdentity();
    window.addEventListener('laundry-profile-updated', syncIdentity);
    return () => window.removeEventListener('laundry-profile-updated', syncIdentity);
  }, []);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      if (!navigator.onLine) {
        if (live) { setOffline(true); setLoaded(true); }
        return;
      }
      setOffline(false);
      fetch('/api/washers', {
        headers: { authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        cache: 'no-store',
      }).then((response) => {
        if (!response.ok) throw new Error('세탁기 상태를 불러오지 못했습니다.');
        return response.json();
      }).then((data) => {
        if (!live) return;
        const current = (data.washers as Washer[]).find((item) => item.id === washerId) ?? null;
        setWasher(current);
        setLoadError(current ? '' : '세탁기를 찾을 수 없습니다.');
        setLoaded(true);
      }).catch(() => {
        if (!live) return;
        setLoadError('세탁기 상태를 불러오지 못했습니다.');
        setLoaded(true);
      });
    };
    load();
    const interval = setInterval(load, 4000);
    document.addEventListener('visibilitychange', load);
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', load);
    };
  }, [washerId]);

  async function mutate(action: 'reserve' | 'cancel' | 'pickup') {
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch(`/api/washers/${washerId}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        body: '{}',
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('laundry-token');
          localStorage.removeItem('laundry-user');
          window.dispatchEvent(new Event('laundry-profile-updated'));
        }
        throw new Error(typeof data.error === 'string' ? data.error : '요청을 처리하지 못했습니다.');
      }
      setWasher(data.washer);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const own = !!washer?.currentUserId && washer.currentUserId === userId;
  const finished = washer?.state === 'FINISHED' || washer?.state === 'WAITING_FOR_PICKUP';
  const status = washer ? washerPresentation(washer.state) : null;
  const headline = washer?.state === 'RESERVED' && !own
    ? '다른 사용자가 시작을 기다리고 있어요'
    : washer?.state === 'WAITING_FOR_PICKUP' && !own
      ? '세탁물 수거를 기다리고 있어요'
      : status?.headline;
  const time = washer?.finishedAt && finished ? `${timeLabel(washer.finishedAt)} 완료`
    : washer?.startedAt ? `${timeLabel(washer.startedAt)} 시작` : '';

  return <>
    <div className="topline"><Link className="back" href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={20} /></Link><span className="eyebrow">{washer?.location ?? '기숙사 세탁실'}</span></div>
    {!washer ? <>
      <h1>{loaded && loadError === '세탁기를 찾을 수 없습니다.' ? '세탁기를 찾을 수 없어요' : '세탁기 상태'}</h1>
      <p className="muted" role="status">{loadError || (offline ? '인터넷 연결을 확인해주세요.' : '세탁기 상태를 불러오는 중…')}</p>
      {loadError && <button className="button secondary" type="button" onClick={() => location.reload()}>다시 시도</button>}
    </> : <>
      <h1>{washer.name}</h1>
      <section className="status-panel" aria-label="현재 세탁기 상태">
        <WasherStatus state={washer.state} />
        <h2 className="status-big">{headline}</h2>
        {time && <p className="lead">{time}</p>}
      </section>

      <div className="detail-list">
        <div className="detail-row"><span>세탁 상태</span><span>{status?.label}</span></div>
        <div className="detail-row"><span>최근 활동</span><span>{timeLabel(washer.lastActivityAt) || '—'}</span></div>
      </div>

      {offline && <p className="notice" role="status">오프라인 상태입니다. 마지막으로 확인한 상태를 보여드려요.</p>}
      {loadError && !offline && <p className="notice" role="status">{loadError} 마지막으로 확인한 상태를 보여드려요.</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}

      {!offline && <div className="action-stack">
        {washer.state === 'IDLE' && <>
          <p className="action-hint">사용을 등록한 뒤 세탁기의 시작 버튼을 눌러주세요.</p>
          <button className="button" type="button" disabled={busy} onClick={() => mutate('reserve')}>{busy ? '등록 중…' : '이 세탁기 사용 등록'}</button>
        </>}
        {own && washer.state === 'RESERVED' && <>
          <p className="action-hint">세탁기의 시작 버튼을 누르면 상태가 자동으로 바뀝니다.</p>
          <button className="button secondary" type="button" disabled={busy} onClick={() => mutate('cancel')}>{busy ? '취소 중…' : '사용 등록 취소'}</button>
        </>}
        {own && finished && <>
          <p className="action-hint">세탁물을 꺼냈다면 수거 완료를 눌러주세요.</p>
          <button className="button" type="button" disabled={busy} onClick={() => mutate('pickup')}>{busy ? '처리 중…' : '수거 완료'}</button>
        </>}
      </div>}
    </>}
  </>;
}
