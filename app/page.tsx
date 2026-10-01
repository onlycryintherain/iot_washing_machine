'use client';

import Link from 'next/link';
import { ArrowRight, ScanLine } from 'lucide-react';
import { useWasherOverview } from '@/components/use-washer-overview';
import { WasherRow } from '@/components/washer-row';
import { WasherStatus } from '@/components/washer-status';

export default function Home() {
  const { washers, myWasher, loaded, error } = useWasherOverview();
  const available = washers.filter((washer) => washer.state === 'IDLE').length;

  return <>
    <div className="topline"><span className="brand">기숙사 세탁실</span></div>

    {myWasher && <Link className="my-wash-card" href={`/washer/${myWasher.id}`}>
      <span className="my-wash-kicker">내 세탁</span>
      <span className="my-wash-content"><strong>{myWasher.name}</strong><WasherStatus state={myWasher.state} /></span>
      <span className="my-wash-link">상태 확인하기 <ArrowRight size={16} aria-hidden="true" /></span>
    </Link>}

    <section className="home-availability" aria-live="polite">
      <p className="eyebrow">세탁실 현황</p>
      {loaded && (!error || washers.length > 0)
        ? <h1>지금 사용 가능한<br />세탁기 <strong>{available}대</strong></h1>
        : <h1>{loaded ? '세탁실 현황을 불러오지 못했어요' : '세탁실 현황을 확인하고 있어요'}</h1>}
    </section>

    <Link className="button home-scan-button" href="/scan"><ScanLine size={19} aria-hidden="true" />QR 스캔하기</Link>
    <p className="home-action-hint">세탁기 앞 QR을 스캔하면 해당 기기 화면으로 이동해요.</p>

    <section className="section home-washers" id="washers">
      <div className="section-head"><h2>세탁기 상태</h2>{loaded && <span className="eyebrow">전체 {washers.length}대</span>}</div>
      {error && <p className="notice" role="status">{error} <button className="text-link" type="button" onClick={() => location.reload()}>다시 시도</button></p>}
      {washers.map((washer) => <WasherRow key={washer.id} washer={washer} />)}
      {!loaded && <p className="muted" role="status">세탁기 상태를 불러오는 중…</p>}
      {loaded && !error && washers.length === 0 && <p className="muted">등록된 세탁기가 없습니다.</p>}
    </section>
  </>;
}
