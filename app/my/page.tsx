'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScanLine, WashingMachine } from 'lucide-react';
import { EventTimeline } from '@/components/event-timeline';
import { FeedbackCard } from '@/components/feedback-card';
import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherStatus } from '@/components/washer-status';
import { WasherTiming } from '@/components/washer-timing';
import { washerPresentation } from '@/lib/washer/presentation';

function timeLabel(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : '—';
}

export default function MyWashPage() {
  const { washers, myWasher, loaded, error, refresh } = useWasherOverview();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const available = washers.filter((washer) => washer.state === 'IDLE').length;

  async function mutate(action: 'cancel' | 'pickup') {
    if (!myWasher) return;
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch(`/api/washers/${myWasher.id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${localStorage.getItem('laundry-token') ?? ''}` },
        body: '{}',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '요청을 처리하지 못했어요.');
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  const topline = <div className="topline"><span className="brand">내 세탁</span><Link className="topline-scan" href="/scan" aria-label="QR 스캔 열기" title="QR 스캔"><ScanLine size={22} strokeWidth={2} aria-hidden="true" /></Link></div>;

  if (!loaded) return <>{topline}<p className="muted" role="status">내 세탁을 불러오는 중이에요…</p></>;

  if (!myWasher) return <>
    {topline}
    <FeedbackCard />
    {error && <p className="notice" role="status">{error}</p>}
    <section className="empty-state">
      <span className="empty-icon" aria-hidden="true"><WashingMachine size={34} strokeWidth={1.6} /></span>
      <h2>세탁 중인 세탁물이 없어요</h2>
      <p className="lead">세탁하려면 세탁기에 붙은 QR을 스캔해주세요.</p>
      <Link className="button" href="/scan"><ScanLine size={20} aria-hidden="true" />QR 스캔하기</Link>
      <Link className="text-link" href="/washers">{available > 0 ? `비어 있는 세탁기 ${available}대 보기` : '세탁기 목록 보기'}</Link>
    </section>
  </>;

  const status = washerPresentation(myWasher.state);
  const running = !!myWasher.startedAt && (myWasher.state === 'RUNNING' || myWasher.state === 'MAYBE_FINISHED');
  const finished = myWasher.state === 'FINISHED' || myWasher.state === 'WAITING_FOR_PICKUP';
  return <>
    {topline}
    <FeedbackCard />
    <section className={`my-card ${status.tone}`} aria-label="내 세탁 현황">
      <span className="my-card-top"><span className="my-card-label">{myWasher.location}</span><WasherStatus state={myWasher.state} /></span>
      <strong className="my-card-name">{myWasher.name}</strong>
      {running ? <WasherTiming startedAt={myWasher.startedAt!} /> : <p className="my-card-text">{finished ? '세탁이 끝났어요. 세탁물을 꺼낸 뒤 수거 완료를 눌러주세요.' : myWasher.state === 'RESERVED' ? '사용 등록을 마쳤어요. 세탁기의 시작 버튼을 눌러주세요.' : status.headline}</p>}
    </section>
    <div className="detail-list">
      <div className="detail-row"><span>세탁 상태</span><span>{status.label}</span></div>
      <div className="detail-row"><span>시작 시각</span><span>{timeLabel(myWasher.startedAt)}</span></div>
      {finished && <div className="detail-row"><span>완료 시각</span><span>{timeLabel(myWasher.finishedAt)}</span></div>}
    </div>
    {actionError && <p className="error" role="alert">{actionError}</p>}
    <div className="my-actions">
      {finished && <button className="button" type="button" disabled={busy} onClick={() => void mutate('pickup')}>{busy ? '처리하는 중…' : '수거 완료하기'}</button>}
      {myWasher.state === 'RESERVED' && <button className="button secondary" type="button" disabled={busy} onClick={() => void mutate('cancel')}>{busy ? '취소하는 중…' : '등록 취소하기'}</button>}
      <Link className="button secondary" href={`/washer/${myWasher.id}`}>세탁기 자세히 보기</Link>
    </div>
    <EventTimeline washerId={myWasher.id} />
  </>;
}
