'use client';

import Link from 'next/link';
import { BellRing, ScanLine } from 'lucide-react';
import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherRow } from '@/components/washer-row';
import { WasherTiming } from '@/components/washer-timing';
import { BrandLogo } from '@/components/brand-logo';

export default function Home() {
  const { washers, myWasher, loaded, error } = useWasherOverview();
  const available = washers.filter((washer) => washer.state === 'IDLE').length;

  return <>
    <div className="topline"><BrandLogo /><Link className="topline-scan" href="/scan" aria-label="QR 스캔 열기" title="QR 스캔"><ScanLine size={22} strokeWidth={2} aria-hidden="true" /></Link></div>
    <h1>세탁실 현황</h1>
    <p className="lead">사용 가능한 세탁기를 확인하고, 완료되면 알림을 받으세요.</p>

    {myWasher && <section className="section">
      <div className="section-head"><h2>내 세탁</h2><BellRing size={17} color="var(--green)" aria-hidden="true" /></div>
      {myWasher.startedAt && (myWasher.state === 'RUNNING' || myWasher.state === 'MAYBE_FINISHED') && <WasherTiming startedAt={myWasher.startedAt} />}
      <WasherRow washer={myWasher} showTiming={false} />
    </section>}

    <div className="summary" aria-live="polite">
      <div className="summary-item"><span className="summary-label">사용 가능</span><strong className="summary-value">{loaded ? available : '—'}</strong></div>
      <div className="summary-item"><span className="summary-label">사용 중</span><strong className="summary-value">{loaded ? washers.length - available : '—'}</strong></div>
    </div>

    <section className="section" id="washers">
      <div className="section-head"><h2>세탁기</h2></div>
      {error && <p className="notice" role="status">{error} <button className="text-link" type="button" onClick={() => location.reload()}>다시 시도</button></p>}
      {washers.map((washer) => <WasherRow key={washer.id} washer={washer} />)}
      {!loaded && <p className="muted" role="status">세탁기 상태를 불러오는 중…</p>}
      {loaded && !error && washers.length === 0 && <p className="muted">등록된 세탁기가 없습니다.</p>}
    </section>
  </>;
}
